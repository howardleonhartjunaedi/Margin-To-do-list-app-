// End-to-end API smoke test against a running dev server.
// Uses the dev account from .env.local (DEV_USER_EMAIL / DEV_USER_PASSWORD), creating it if needed.
// Run: node scripts/smoke-api.mjs [baseUrl]
import { readFileSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const email = env.DEV_USER_EMAIL;
const password = env.DEV_USER_PASSWORD;
if (!email || !password) throw new Error("Set DEV_USER_EMAIL and DEV_USER_PASSWORD in .env.local");

let cookie = "";
async function call(method, path, body, { auth = true } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", origin: base, ...(auth && cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) cookie = set.map((c) => c.split(";")[0]).join("; ");
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text.slice(0, 200);
  }
  return { status: res.status, data };
}

let failures = 0;
const check = (name, ok, extra = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${extra ? ` — ${extra}` : ""}`);
};

const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local

let r = await call("POST", "/api/auth/sign-in/email", { email, password });
if (r.status !== 200) r = await call("POST", "/api/auth/sign-up/email", { email, password, name: "Demo" });
check("sign in / sign up", r.status === 200, String(r.status));

r = await call("GET", "/api/tasks?view=inbox", null, { auth: false });
check("unauthenticated is 401", r.status === 401, String(r.status));

r = await call("POST", "/api/projects", { name: `Smoke ${Date.now() % 10000}`, color: "success" });
check("create project", r.status === 201, JSON.stringify(r.data).slice(0, 120));
const project = r.data;

r = await call("POST", "/api/tasks", {
  title: "Fix the leak",
  projectId: project.id,
  priority: 1,
  dueDate: today,
  dueTime: "14:00",
  labels: ["home", "Urgent", "HOME"],
});
check("create task", r.status === 201 && r.data.labels.length === 2, JSON.stringify(r.data.labels));
const t = r.data;

r = await call("POST", "/api/tasks", { title: "Buy washer", parentId: t.id });
check("create subtask inherits project", r.status === 201 && r.data.projectId === project.id);

r = await call("GET", `/api/tasks?view=today&today=${today}`);
const inToday = r.data.find?.((x) => x.id === t.id);
check("today view lists task with subtask count", inToday?.subtaskCount === 1, JSON.stringify(inToday ?? r.data).slice(0, 160));

r = await call("PATCH", `/api/tasks/${t.id}`, { completed: true });
check("complete", r.status === 200 && r.data.completedAt);
r = await call("GET", `/api/tasks?view=project&id=${project.id}`);
check("completed task leaves the list", r.status === 200 && !r.data.some((x) => x.id === t.id));
r = await call("PATCH", `/api/tasks/${t.id}`, { completed: false });
check("undo complete", r.status === 200 && r.data.completedAt === null);

r = await call("DELETE", `/api/tasks/${t.id}`);
check("soft delete", r.status === 200);
r = await call("PATCH", `/api/tasks/${t.id}`, { deleted: false });
check("restore", r.status === 200);

r = await call("POST", "/api/tasks", { title: "   " });
check("validation message", r.status === 422 && typeof r.data.error === "string", r.data.error);

r = await call("POST", "/api/tasks", { title: "x", projectId: "not-mine" });
check("foreign project rejected", r.status === 404, String(r.status));

r = await call("GET", `/api/counts?today=${today}`);
check("counts", r.status === 200 && typeof r.data.today === "number", JSON.stringify(r.data));

r = await call("DELETE", `/api/projects/${project.id}`);
check("delete project cascades", r.status === 200);
r = await call("GET", `/api/tasks/${t.id}`);
check("task gone with project", r.status === 404, String(r.status));

console.log(failures ? `\n${failures} failed` : "\nAll API checks passed.");
process.exit(failures ? 1 : 0);
