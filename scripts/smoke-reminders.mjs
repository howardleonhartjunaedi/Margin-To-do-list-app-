// Live end-to-end check of Phase 2 against a running dev server (with its in-process scheduler).
// Creates a task due ~1 minute from now with a reminder, then waits for the scheduler to deliver it.
// Run: node scripts/smoke-reminders.mjs [baseUrl]
import { readdirSync, readFileSync, existsSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

let cookie = "";
async function call(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", origin: base, ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) cookie = set.map((c) => c.split(";")[0]).join("; ");
  return { status: res.status, data: await res.json().catch(() => null) };
}
let failures = 0;
const check = (name, ok, extra = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${extra ? ` — ${extra}` : ""}`);
};

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const local = (d) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
};

let r = await call("POST", "/api/auth/sign-in/email", { email: env.DEV_USER_EMAIL, password: env.DEV_USER_PASSWORD });
check("sign in", r.status === 200);

r = await call("PATCH", "/api/settings", { timeZone: "Not/AZone" });
check("rejects unknown time zone", r.status === 422, r.data?.error);
r = await call("PATCH", "/api/settings", { timeZone: tz, emailEnabled: true, quietEnabled: false });
check("settings saved", r.status === 200 && r.data.timeZone === tz, tz);

// Due two minutes from now (whole minutes), reminder one minute before → fires within ~60s.
const due = local(new Date(Date.now() + 2 * 60_000));
r = await call("POST", "/api/tasks", { id: crypto.randomUUID(), title: `Smoke reminder ${due.time}`, dueDate: due.date, dueTime: due.time });
const task = r.data;
check("task created", r.status === 201);
r = await call("POST", `/api/tasks/${task.id}/reminders`, { offsetMinutes: 1 });
check("reminder created", r.status === 201 && r.data[0]?.status === "pending", r.data?.[0]?.fireAt);
const reminderId = r.data[0].id;

r = await call("POST", `/api/tasks/${task.id}/reminders`, { at: "2020-01-01T00:00:00Z" });
check("past reminder recorded as passed", r.status === 201 && r.data.some((x) => x.status === "skipped"));

const outbox = new URL("../.data/outbox/", import.meta.url);
const before = existsSync(outbox) ? readdirSync(outbox).length : 0;
const started = Date.now();
let delivered = null;
process.stdout.write("     waiting for the scheduler");
while (Date.now() - started < 150_000) {
  await new Promise((res) => setTimeout(res, 5000));
  process.stdout.write(".");
  const n = await call("GET", "/api/notifications");
  delivered = n.data.items.find((x) => x.reminderId === reminderId);
  if (delivered) break;
}
console.log("");
check("scheduler delivered in-app notification", !!delivered, delivered ? `after ${Math.round((Date.now() - started) / 1000)}s: ${delivered.body}` : "timed out");
const after = existsSync(outbox) ? readdirSync(outbox).length : 0;
check("email written to dev outbox", after > before);

r = await call("POST", `/api/reminders/${reminderId}/snooze`, { minutes: 10 });
check("snooze", r.status === 200 && new Date(r.data.fireAt) > new Date(Date.now() + 9 * 60_000), r.data?.fireAt);
r = await call("POST", "/api/notifications", { all: true });
check("mark all read", r.status === 200 && r.data.unread === 0);

// Recurring completion moves the task forward instead of closing it.
r = await call("POST", "/api/tasks", { id: crypto.randomUUID(), title: "Smoke daily", dueDate: due.date, recurrence: "FREQ=DAILY" });
const daily = r.data;
r = await call("PATCH", `/api/tasks/${daily.id}`, { completed: true });
check("recurring task advances", r.status === 200 && r.data.completedAt === null && r.data.dueDate > due.date, r.data?.dueDate);
r = await call("PATCH", `/api/tasks/${daily.id}`, { completed: false, dueDate: due.date });
check("undo recurring completion", r.data?.dueDate === due.date);

for (const id of [task.id, daily.id]) await call("DELETE", `/api/tasks/${id}`);
console.log(failures ? `\n${failures} failed` : "\nAll reminder checks passed.");
process.exit(failures ? 1 : 0);
