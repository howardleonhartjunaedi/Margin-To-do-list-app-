import { PGlite } from "@electric-sql/pglite";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { instantToZoned, zonedToInstant } from "@/lib/time/zone";
import * as schema from "../db/schema";
import type { Db } from "../db/types";
import { addReminder, recomputeTaskReminders, snoozeReminder } from "../reminders";
import { runTick, type Channels, type OutboundMessage } from "./core";

/*
 * Timing tests for the scheduler against a real (in-memory) Postgres.
 * Time never comes from the wall clock: every tick gets an explicit `now`.
 */

const TZ = "Europe/London";
const at = (date: string, time: string) => zonedToInstant(date, time, TZ);
const plus = (d: Date, ms: number) => new Date(d.getTime() + ms);

let db: Db;
let sent: { channel: "push" | "email"; msg: OutboundMessage }[];
let channels: Channels;
let failPush = false;

async function freshDb() {
  const client = new PGlite();
  const d = drizzle({ client, schema, casing: "snake_case" });
  await migrate(d, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return d as unknown as Db;
}

async function seedUser(id = "u1", settings: Partial<typeof schema.userSettings.$inferInsert> = {}) {
  await db.insert(schema.user).values({ id, name: "Test", email: `${id}@margin.test` });
  await db.insert(schema.userSettings).values({ userId: id, timeZone: TZ, emailEnabled: true, ...settings });
}

async function seedTask(over: Partial<typeof schema.task.$inferInsert> = {}) {
  const [t] = await db
    .insert(schema.task)
    .values({ userId: "u1", title: "Call the plumber", sortKey: "a0", dueDate: "2026-10-20", dueTime: "15:00", ...over })
    .returning();
  return t;
}

const notifications = () => db.select().from(schema.notification).where(eq(schema.notification.userId, "u1"));
const reminderRow = async (id: string) => (await db.select().from(schema.reminder).where(eq(schema.reminder.id, id)))[0];

beforeEach(async () => {
  db = await freshDb();
  sent = [];
  failPush = false;
  channels = {
    push: async (msg) => {
      if (failPush) throw new Error("push service down");
      sent.push({ channel: "push", msg });
    },
    email: async (msg) => void sent.push({ channel: "email", msg }),
  };
  await seedUser();
}, 30_000);

describe("reminder delivery", () => {
  it("fires at its moment — not a second early — and exactly once", async () => {
    const t = await seedTask();
    const r = await addReminder(db, "u1", t, { offsetMinutes: 30 }, at("2026-10-19", "12:00"));
    const fireAt = at("2026-10-20", "14:30");
    expect(r.fireAt?.toISOString()).toBe(fireAt.toISOString());

    expect((await runTick(db, plus(fireAt, -1000), channels)).sent).toBe(0);
    const report = await runTick(db, fireAt, channels);
    expect(report).toMatchObject({ sent: 1, late: 0 });
    expect(sent.map((s) => s.channel).sort()).toEqual(["email", "push"]);
    expect(sent[0].msg.body).toBe("Due Today 15:00");

    // Further ticks do nothing.
    await runTick(db, plus(fireAt, 15_000), channels);
    await runTick(db, plus(fireAt, 60_000), channels);
    expect(await notifications()).toHaveLength(1);
    expect(sent).toHaveLength(2);
    expect((await reminderRow(r.id)).status).toBe("sent");
  });

  it("respects channel settings", async () => {
    await db.update(schema.userSettings).set({ emailEnabled: false, pushEnabled: false });
    const t = await seedTask();
    await addReminder(db, "u1", t, { offsetMinutes: 0 }, at("2026-10-19", "12:00"));
    await runTick(db, at("2026-10-20", "15:00"), channels);
    expect(await notifications()).toHaveLength(1); // in-app is always on
    expect(sent).toHaveLength(0);
  });

  it("skips reminders for completed or deleted tasks", async () => {
    const done = await seedTask({ completedAt: new Date() });
    const gone = await seedTask({ deletedAt: new Date() });
    await addReminder(db, "u1", done, { offsetMinutes: 0 }, at("2026-10-19", "12:00"));
    await addReminder(db, "u1", gone, { offsetMinutes: 0 }, at("2026-10-19", "12:00"));
    const report = await runTick(db, at("2026-10-20", "15:00"), channels);
    expect(report).toMatchObject({ sent: 0, skipped: 2 });
    expect(await notifications()).toHaveLength(0);
  });

  it("defers through quiet hours to the end of the window", async () => {
    await db.update(schema.userSettings).set({ quietEnabled: true, quietStart: "22:00", quietEnd: "07:00" });
    const t = await seedTask({ dueTime: "23:30" });
    const r = await addReminder(db, "u1", t, { offsetMinutes: 0 }, at("2026-10-19", "12:00"));

    const report = await runTick(db, at("2026-10-20", "23:30"), channels);
    expect(report).toMatchObject({ sent: 0, deferred: 1 });
    const deferred = await reminderRow(r.id);
    expect(instantToZoned(deferred.fireAt!, TZ)).toEqual({ date: "2026-10-21", time: "07:00" });

    expect((await runTick(db, at("2026-10-21", "06:59"), channels)).sent).toBe(0);
    expect((await runTick(db, at("2026-10-21", "07:00"), channels)).sent).toBe(1);
    expect(sent.length).toBe(2);
  });

  it("snooze re-arms a sent reminder", async () => {
    const t = await seedTask();
    const r = await addReminder(db, "u1", t, { offsetMinutes: 0 }, at("2026-10-19", "12:00"));
    const fire = at("2026-10-20", "15:00");
    await runTick(db, fire, channels);
    await snoozeReminder(db, "u1", r.id, plus(fire, 10 * 60_000));
    expect((await runTick(db, plus(fire, 9 * 60_000), channels)).sent).toBe(0);
    expect((await runTick(db, plus(fire, 10 * 60_000), channels)).sent).toBe(1);
    expect(await notifications()).toHaveLength(2);
  });

  it("snooze can't touch another user's reminder", async () => {
    await seedUser("u2");
    const t = await seedTask();
    const r = await addReminder(db, "u1", t, { offsetMinutes: 0 });
    expect(await snoozeReminder(db, "u2", r.id, new Date())).toBeNull();
  });

  it("reminders long overdue arrive in-app only", async () => {
    const t = await seedTask();
    await addReminder(db, "u1", t, { offsetMinutes: 0 }, at("2026-10-19", "12:00"));
    // Server was down for three hours.
    const report = await runTick(db, at("2026-10-20", "18:00"), channels);
    expect(report).toMatchObject({ sent: 1, late: 1 });
    expect(await notifications()).toHaveLength(1);
    expect(sent).toHaveLength(0);
  });

  it("a failing push channel doesn't lose the reminder or cause a resend", async () => {
    failPush = true;
    const t = await seedTask();
    const r = await addReminder(db, "u1", t, { offsetMinutes: 0 }, at("2026-10-19", "12:00"));
    await runTick(db, at("2026-10-20", "15:00"), channels);
    await runTick(db, at("2026-10-20", "15:01"), channels);
    expect((await reminderRow(r.id)).status).toBe("sent");
    expect(await notifications()).toHaveLength(1);
    expect(sent.map((s) => s.channel)).toEqual(["email"]);
  });

  it("overlapping ticks never double-send", async () => {
    const t = await seedTask();
    for (let i = 0; i < 5; i++) await addReminder(db, "u1", t, { offsetMinutes: i }, at("2026-10-19", "12:00"));
    const now = at("2026-10-20", "15:00");
    const reports = await Promise.all([runTick(db, now, channels), runTick(db, now, channels), runTick(db, now, channels)]);
    expect(reports.reduce((n, r) => n + r.sent, 0)).toBe(5);
    expect(await notifications()).toHaveLength(5);
  });

  it("rescheduling a task moves its reminders and re-arms them", async () => {
    const t = await seedTask();
    const r = await addReminder(db, "u1", t, { offsetMinutes: 60 }, at("2026-10-19", "12:00"));
    await runTick(db, at("2026-10-20", "14:00"), channels);
    expect((await reminderRow(r.id)).status).toBe("sent");

    await db.update(schema.task).set({ dueDate: "2026-10-22", dueTime: "10:00" }).where(eq(schema.task.id, t.id));
    await recomputeTaskReminders(db, "u1", t.id, at("2026-10-20", "16:00"));
    const moved = await reminderRow(r.id);
    expect(moved.status).toBe("pending");
    expect(instantToZoned(moved.fireAt!, TZ)).toEqual({ date: "2026-10-22", time: "09:00" });
  });

  it("date-only tasks remind at the user's day time, across a DST change", async () => {
    await db.update(schema.userSettings).set({ dayTime: "08:30" });
    // UK clocks go back on 25 Oct 2026.
    const t = await seedTask({ dueDate: "2026-10-26", dueTime: null });
    const r = await addReminder(db, "u1", t, { offsetMinutes: 0 }, at("2026-10-19", "12:00"));
    expect(r.fireAt?.toISOString()).toBe("2026-10-26T08:30:00.000Z"); // GMT, not BST
  });

  it("a reminder already in the past when created is recorded but never fires", async () => {
    const t = await seedTask({ dueDate: "2026-10-01" });
    const r = await addReminder(db, "u1", t, { offsetMinutes: 0 }, at("2026-10-19", "12:00"));
    expect(r.status).toBe("skipped");
    expect((await runTick(db, at("2026-10-19", "12:01"), channels)).sent).toBe(0);
  });
});

describe("daily digest", () => {
  beforeEach(async () => {
    await db.update(schema.userSettings).set({ digestEnabled: true, digestTime: "08:00" });
  });

  it("sends once per local day, after the chosen time", async () => {
    await seedTask({ title: "Overdue thing", dueDate: "2026-10-19", dueTime: null });
    await seedTask({ title: "Today thing", dueDate: "2026-10-20", dueTime: "11:00" });
    await seedTask({ title: "Tomorrow thing", dueDate: "2026-10-21" });

    expect((await runTick(db, at("2026-10-20", "07:59"), channels)).digests).toBe(0);
    expect((await runTick(db, at("2026-10-20", "08:00"), channels)).digests).toBe(1);
    expect((await runTick(db, at("2026-10-20", "12:00"), channels)).digests).toBe(0);

    const [n] = await db.select().from(schema.notification).where(and(eq(schema.notification.kind, "digest")));
    expect(n.title).toBe("Today: 1 task, 1 overdue");
    expect(n.body).toContain("Today thing — 11:00");
    expect(n.body).not.toContain("Tomorrow thing");
    expect(sent.filter((s) => s.channel === "email")).toHaveLength(1);

    expect((await runTick(db, at("2026-10-21", "08:00"), channels)).digests).toBe(1);
  });

  it("stays quiet when nothing is due", async () => {
    await seedTask({ dueDate: "2026-10-25" });
    expect((await runTick(db, at("2026-10-20", "08:00"), channels)).digests).toBe(0);
    expect(await notifications()).toHaveLength(0);
  });
});
