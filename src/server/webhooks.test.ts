import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { backoffMs, DISABLE_AFTER, MAX_ATTEMPTS, sign, verify } from "@/lib/webhook-sign";
import * as schema from "./db/schema";
import type { Db } from "./db/types";
import { enqueueWebhooks } from "./events";
import { isPrivateAddress } from "./net-guard";
import { deliverWebhooks, type Fetcher } from "./webhooks";

describe("signatures", () => {
  const secret = "whsec_test";
  const body = JSON.stringify({ event: "task.created", data: { id: 1 } });
  it("verifies its own signature and rejects tampering, wrong secrets and replays", () => {
    const t = 1_800_000_000;
    const h = sign(secret, body, t);
    expect(h).toMatch(/^t=1800000000,v1=[0-9a-f]{64}$/);
    expect(verify(secret, body, h, t + 10)).toBe(true);
    expect(verify(secret, body + " ", h, t + 10)).toBe(false);
    expect(verify("whsec_other", body, h, t + 10)).toBe(false);
    expect(verify(secret, body, h, t + 3600)).toBe(false);
    expect(verify(secret, body, "garbage", t)).toBe(false);
  });
  it("backs off exponentially", () => {
    expect([1, 2, 3, 6].map(backoffMs)).toEqual([30_000, 60_000, 120_000, 960_000]);
  });
});

describe("SSRF guard", () => {
  it("flags private, loopback, link-local and mapped addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "not-an-ip"])
      expect(isPrivateAddress(ip), ip).toBe(true);
    for (const ip of ["93.184.216.34", "1.1.1.1", "2606:4700:4700::1111", "172.32.0.1"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });
});

describe("delivery", () => {
  let db: Db;
  let hookId: string;
  const calls: { url: string; init: RequestInit }[] = [];
  let respond: number | Error = 200;
  const fetcher: Fetcher = async (url, init) => {
    calls.push({ url, init });
    if (respond instanceof Error) throw respond;
    return { status: respond };
  };
  // Deliveries are enqueued with the real clock (defaultNow), so "now" in these tests must be
  // after it — a fixed date made the suite pass or fail depending on the time of day.
  const t0 = new Date(Math.ceil(Date.now() / 1000) * 1000 + 60_000);
  const at = (ms: number) => new Date(t0.getTime() + ms);

  beforeEach(async () => {
    const client = new PGlite();
    const d = drizzle({ client, schema, casing: "snake_case" });
    await migrate(d, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    db = d as unknown as Db;
    calls.length = 0;
    respond = 200;
    await db.insert(schema.user).values({ id: "u1", name: "U", email: "u@margin.test" });
    await db.insert(schema.user).values({ id: "u2", name: "V", email: "v@margin.test" });
    const [w] = await db.insert(schema.webhook).values({ userId: "u1", url: "https://example.com/hook", secret: "whsec_x", events: "task.created,task.completed" }).returning();
    hookId = w.id;
  }, 30_000);

  const deliveries = () => db.select().from(schema.webhookDelivery);

  it("queues only for subscribed events and owners, then sends a signed request once", async () => {
    await enqueueWebhooks(db, ["u1"], "task.updated", {}); // not subscribed
    await enqueueWebhooks(db, ["u2"], "task.created", {}); // someone else's event
    await enqueueWebhooks(db, ["u1", "u1"], "task.created", { task: { id: "t1" } });
    expect(await deliveries()).toHaveLength(1);

    expect(await deliverWebhooks(db, t0, fetcher)).toEqual({ sent: 1, failed: 0 });
    expect(await deliverWebhooks(db, at(1000), fetcher)).toEqual({ sent: 0, failed: 0 });
    expect(calls).toHaveLength(1);
    const h = calls[0].init.headers as Record<string, string>;
    expect(h["x-margin-event"]).toBe("task.created");
    expect(verify("whsec_x", calls[0].init.body as string, h["x-margin-signature"], Math.floor(t0.getTime() / 1000))).toBe(true);
    expect(JSON.parse(calls[0].init.body as string)).toMatchObject({ event: "task.created", data: { task: { id: "t1" } } });
  });

  it("retries failures with backoff, then gives up", async () => {
    respond = 500;
    await enqueueWebhooks(db, ["u1"], "task.completed", {});
    let now = t0;
    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
      await deliverWebhooks(db, now, fetcher);
      expect(await deliverWebhooks(db, new Date(now.getTime() + backoffMs(i) - 1), fetcher)).toEqual({ sent: 0, failed: 0 }); // not yet
      now = new Date(now.getTime() + backoffMs(i));
    }
    const [d] = await deliveries();
    expect(d).toMatchObject({ status: "failed", attempts: MAX_ATTEMPTS, responseStatus: 500 });
    expect(calls).toHaveLength(MAX_ATTEMPTS);
  });

  it("a network error counts as a failure and is recorded", async () => {
    respond = new Error("connect ECONNREFUSED");
    await enqueueWebhooks(db, ["u1"], "task.created", {});
    await deliverWebhooks(db, t0, fetcher);
    const [d] = await deliveries();
    expect(d).toMatchObject({ status: "pending", attempts: 1, error: "connect ECONNREFUSED" });
  });

  it("switches off an endpoint that keeps failing; success resets the count", async () => {
    respond = 503;
    await db.update(schema.webhook).set({ failureCount: DISABLE_AFTER - 1 }).where(eq(schema.webhook.id, hookId));
    await enqueueWebhooks(db, ["u1"], "task.created", {});
    await deliverWebhooks(db, t0, fetcher);
    const [w] = await db.select().from(schema.webhook);
    expect(w.active).toBe(false);
    // Queued deliveries for a switched-off endpoint fail without sending.
    await enqueueWebhooks(db, ["u1"], "task.created", {}); // not queued: inactive
    expect(await deliveries()).toHaveLength(1);
  });
});
