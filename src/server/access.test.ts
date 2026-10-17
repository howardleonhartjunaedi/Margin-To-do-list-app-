import { PGlite } from "@electric-sql/pglite";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { atLeast, audienceForTask, forMe, projectRole, requireTaskRole, taskAccess, visibleTask } from "./access";
import * as schema from "./db/schema";
import type { Db } from "./db/types";

/*
 * The access rules, against a real Postgres. Three people:
 *   ana — owns project "Home" (shared with ben as editor, cat as viewer) and has an Inbox task
 *   ben — editor on Home; his own private project "Ben's"
 *   cat — viewer on Home
 */

let db: Db;
const ids = {} as Record<string, string>;

beforeAll(async () => {
  const client = new PGlite();
  const d = drizzle({ client, schema, casing: "snake_case" });
  await migrate(d, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  db = d as unknown as Db;

  for (const u of ["ana", "ben", "cat"]) await db.insert(schema.user).values({ id: u, name: u, email: `${u}@margin.test` });
  const mkProject = async (key: string, owner: string, name: string) => {
    const [p] = await db.insert(schema.project).values({ userId: owner, name, sortKey: "a0" }).returning();
    await db.insert(schema.projectMember).values({ projectId: p.id, userId: owner, role: "owner" });
    ids[key] = p.id;
  };
  await mkProject("home", "ana", "Home");
  await mkProject("bens", "ben", "Ben's");
  await db.insert(schema.projectMember).values([
    { projectId: ids.home, userId: "ben", role: "editor" },
    { projectId: ids.home, userId: "cat", role: "viewer" },
  ]);
  const mkTask = async (key: string, over: Partial<typeof schema.task.$inferInsert>) => {
    const [t] = await db.insert(schema.task).values({ userId: "ana", title: key, sortKey: "a0", ...over }).returning();
    ids[key] = t.id;
  };
  await mkTask("anaInbox", { userId: "ana", dueDate: "2026-10-18" });
  await mkTask("benInbox", { userId: "ben", dueDate: "2026-10-18" });
  await mkTask("homeByAna", { userId: "ana", projectId: ids.home, dueDate: "2026-10-18" });
  await mkTask("homeByBen", { userId: "ben", projectId: ids.home, dueDate: "2026-10-18" });
  await mkTask("homeForCat", { userId: "ana", projectId: ids.home, assigneeId: "cat", dueDate: "2026-10-18" });
  await mkTask("bensPrivate", { userId: "ben", projectId: ids.bens });
}, 30_000);

const visibleTo = async (u: string) =>
  (await db.select({ title: schema.task.title }).from(schema.task).where(visibleTask(u))).map((r) => r.title).sort();
const todayFor = async (u: string) =>
  (await db.select({ title: schema.task.title }).from(schema.task).where(and(visibleTask(u), forMe(u)))).map((r) => r.title).sort();

describe("visibility", () => {
  it("Inbox is private; shared projects are visible to members; private projects aren't", async () => {
    expect(await visibleTo("ana")).toEqual(["anaInbox", "homeByAna", "homeByBen", "homeForCat"]);
    expect(await visibleTo("ben")).toEqual(["benInbox", "bensPrivate", "homeByAna", "homeByBen", "homeForCat"]);
    expect(await visibleTo("cat")).toEqual(["homeByAna", "homeByBen", "homeForCat"]);
  });

  it("date views show what's yours: assigned to you, or unassigned and added by you", async () => {
    expect(await todayFor("ana")).toEqual(["anaInbox", "homeByAna"]);
    expect(await todayFor("ben")).toEqual(["benInbox", "bensPrivate", "homeByBen"]);
    expect(await todayFor("cat")).toEqual(["homeForCat"]);
  });

  it("a removed member loses access immediately", async () => {
    await db.delete(schema.projectMember).where(and(eq(schema.projectMember.projectId, ids.home), eq(schema.projectMember.userId, "cat")));
    expect(await visibleTo("cat")).toEqual([]);
    expect(await taskAccess(db, "cat", ids.homeByAna)).toBeNull();
    await db.insert(schema.projectMember).values({ projectId: ids.home, userId: "cat", role: "viewer" });
  });
});

describe("roles", () => {
  it("roles rank viewer < commenter < editor < owner", () => {
    expect(atLeast("editor", "commenter")).toBe(true);
    expect(atLeast("viewer", "commenter")).toBe(false);
    expect(atLeast(null, "viewer")).toBe(false);
  });

  it("reports each person's role per project, and owner for your own Inbox", async () => {
    expect(await projectRole(db, "ben", ids.home)).toBe("editor");
    expect(await projectRole(db, "cat", ids.bens)).toBeNull();
    expect((await taskAccess(db, "ana", ids.anaInbox))?.role).toBe("owner");
    expect(await taskAccess(db, "ben", ids.anaInbox)).toBeNull();
  });

  it("enforces the minimum role with 404 for invisible and 403 for insufficient", async () => {
    await expect(requireTaskRole(db, "ben", ids.homeByAna, "editor")).resolves.toMatchObject({ role: "editor" });
    await expect(requireTaskRole(db, "cat", ids.homeByAna, "editor")).rejects.toMatchObject({ status: 403 });
    await expect(requireTaskRole(db, "cat", ids.homeByAna, "viewer")).resolves.toMatchObject({ role: "viewer" });
    await expect(requireTaskRole(db, "cat", ids.bensPrivate, "viewer")).rejects.toMatchObject({ status: 404 });
    await expect(requireTaskRole(db, "ben", ids.anaInbox, "viewer")).rejects.toMatchObject({ status: 404 });
  });

  it("changes reach every member of a project, but only the owner of an Inbox task", async () => {
    expect((await audienceForTask(db, { userId: "ana", projectId: ids.home })).sort()).toEqual(["ana", "ben", "cat"]);
    expect(await audienceForTask(db, { userId: "ana", projectId: null })).toEqual(["ana"]);
  });
});
