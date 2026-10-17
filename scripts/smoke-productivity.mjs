// Phase 4 API checks: estimates, focus sessions, habits, daily notes, stats.
// Run: node scripts/smoke-productivity.mjs [baseUrl]   (dev account from .env.local)
import { readFileSync } from "node:fs";

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

await call("POST", "/api/auth/sign-in/email", { email: env.DEV_USER_EMAIL, password: env.DEV_USER_PASSWORD });
const settings = (await call("GET", "/api/settings")).data;
const today = new Date().toLocaleDateString("en-CA", { timeZone: settings.timeZone });
const tag = `zp${Date.now() % 100000}`;

let r = await call("POST", "/api/tasks", { id: crypto.randomUUID(), title: `Estimate ${tag}`, dueDate: today, estimateMinutes: 45 });
check("task with estimate", r.status === 201 && r.data.estimateMinutes === 45);
const t = r.data;
r = await call("POST", "/api/tasks", { title: "x", estimateMinutes: 5000 });
check("estimate over a day rejected", r.status === 422);

r = await call("GET", `/api/days/${today}`);
check("day load counts estimate", r.status === 200 && r.data.load.estimatedMinutes >= 45, JSON.stringify(r.data?.load));
r = await call("PUT", `/api/days/${today}`, { intention: `Ship it ${tag}`, capacityMinutes: 240, planned: true });
check("save plan", r.data?.intention === `Ship it ${tag}` && r.data.plannedAt && r.data.capacityMinutes === 240);
r = await call("PUT", `/api/days/${today}`, { reflection: "Went fine", reviewed: true });
check("save review keeps plan", r.data?.reflection === "Went fine" && r.data.intention === `Ship it ${tag}` && r.data.reviewedAt);
r = await call("GET", `/api/days/not-a-date`);
check("bad date rejected", r.status === 422);

const start = new Date(Date.now() - 26 * 60_000).toISOString();
r = await call("POST", "/api/focus", { taskId: t.id, kind: "focus", plannedSeconds: 1500, actualSeconds: 1500, completed: true, startedAt: start, endedAt: new Date().toISOString() });
check("record focus session", r.status === 201);
r = await call("GET", `/api/tasks/${t.id}`);
check("task detail shows focus", r.data?.focus?.minutes === 25 && r.data.focus.sessions === 1, JSON.stringify(r.data?.focus));

r = await call("PATCH", `/api/tasks/${t.id}`, { completed: true });
r = await call("GET", `/api/days/${today}`);
check("review lists today's completion", r.data?.completed?.some((c) => c.id === t.id));
r = await call("GET", `/api/stats?from=${today}&to=${today}`);
check("stats count today's completion", (r.data?.completedByDay?.[today] ?? 0) >= 1, JSON.stringify(r.data?.completedByDay));
check("stats count focus minutes", (r.data?.focusMinutesByDay?.[today] ?? 0) >= 25);
check("stats has 24 hours", r.data?.byHour?.length === 24);
r = await call("GET", `/api/stats?from=2020-01-01&to=${today}`);
check("stats range capped", r.status === 422, r.data?.error);

r = await call("POST", "/api/habits", { id: crypto.randomUUID(), name: `Stretch ${tag}`, targetPerWeek: 3 });
const h = r.data?.find((x) => x.name === `Stretch ${tag}`);
check("create habit", r.status === 201 && h?.targetPerWeek === 3);
await call("PUT", `/api/habits/${h.id}/checks`, { date: today, done: true });
r = await call("PUT", `/api/habits/${h.id}/checks`, { date: today, done: true });
check("check is idempotent", r.status === 200);
r = await call("GET", "/api/habits");
check("check recorded once", r.data.find((x) => x.id === h.id).checks.filter((d) => d === today).length === 1);
await call("PUT", `/api/habits/${h.id}/checks`, { date: today, done: false });
r = await call("GET", "/api/habits");
check("uncheck", r.data.find((x) => x.id === h.id).checks.length === 0);
r = await call("PUT", `/api/habits/not-mine/checks`, { date: today, done: true });
check("foreign habit rejected", r.status === 404);
r = await call("PATCH", `/api/habits/${h.id}`, { archived: true });
check("archive hides habit", !r.data.some((x) => x.id === h.id));
r = await call("DELETE", `/api/habits/${h.id}`);
check("delete habit", r.status === 200);

await call("PATCH", `/api/tasks/${t.id}`, { completed: false });
await call("DELETE", `/api/tasks/${t.id}`);
await call("PUT", `/api/days/${today}`, { intention: "", reflection: "", capacityMinutes: null, planned: false, reviewed: false });
console.log(failures ? `\n${failures} failed` : "\nAll productivity checks passed.");
process.exit(failures ? 1 : 0);
