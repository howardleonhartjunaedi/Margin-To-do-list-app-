// Phase 5 checks with two real accounts: sharing, roles, comments, assignments, real-time,
// API tokens, iCal, import/export, webhooks. Uses DEV_USER_* and DEV_USER2_* from .env.local
// (the second account is created on first run).
// Run: node scripts/smoke-sharing.mjs [baseUrl]
import { appendFileSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const base = process.argv[2] ?? "http://localhost:3000";
const envPath = new URL("../.env.local", import.meta.url);
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
if (!env.DEV_USER2_EMAIL) {
  env.DEV_USER2_EMAIL = "collab@margin.test";
  env.DEV_USER2_PASSWORD = `dev-${randomBytes(9).toString("base64url")}`;
  appendFileSync(envPath, `# Second local test account (sharing tests)\nDEV_USER2_EMAIL=${env.DEV_USER2_EMAIL}\nDEV_USER2_PASSWORD=${env.DEV_USER2_PASSWORD}\n`);
}

function client() {
  let cookie = "";
  const call = async (method, path, body, headers = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { "content-type": "application/json", origin: base, ...(cookie ? { cookie } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.getSetCookie?.() ?? [];
    if (set.length) cookie = set.map((c) => c.split(";")[0]).join("; ");
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data, headers: res.headers };
  };
  return { call, cookie: () => cookie };
}

let failures = 0;
const check = (name, ok, extra = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${extra ? ` — ${extra}` : ""}`);
};
const signIn = async (c, email, password, name) => {
  let r = await c.call("POST", "/api/auth/sign-in/email", { email, password });
  if (r.status !== 200) r = await c.call("POST", "/api/auth/sign-up/email", { email, password, name });
  return r;
};

const ana = client();
const ben = client();
check("owner signs in", (await signIn(ana, env.DEV_USER_EMAIL, env.DEV_USER_PASSWORD, "Demo")).status === 200);
check("collaborator signs in", (await signIn(ben, env.DEV_USER2_EMAIL, env.DEV_USER2_PASSWORD, "Collab")).status === 200);
const benId = (await ben.call("GET", "/api/auth/get-session")).data.user.id;
const tag = `zs${Date.now() % 100000}`;

// Real-time: listen as ben before anything happens.
const events = [];
const ctrl = new AbortController();
(async () => {
  try {
    const res = await fetch(base + "/api/events", { headers: { cookie: ben.cookie() }, signal: ctrl.signal });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      for (const m of dec.decode(value).matchAll(/event: change\ndata: (.*)\n/g)) events.push(JSON.parse(m[1]));
    }
  } catch {}
})();

// Private by default
let r = await ana.call("POST", "/api/projects", { name: `Shared ${tag}`, color: "p3" });
const project = r.data;
r = await ana.call("POST", "/api/tasks", { id: crypto.randomUUID(), title: `Secret ${tag}`, projectId: project.id });
const secret = r.data;
r = await ben.call("GET", `/api/tasks/${secret.id}`);
check("non-member can't read a task", r.status === 404, String(r.status));
r = await ben.call("PATCH", `/api/tasks/${secret.id}`, { title: "hacked" });
check("non-member can't edit a task", r.status === 404, String(r.status));
r = await ben.call("GET", `/api/projects/${project.id}/members`);
check("non-member can't list members", r.status === 404);

// Invite bound to an email, accepted by that account
r = await ben.call("POST", `/api/projects/${project.id}/invites`, { role: "editor" });
check("non-owner can't invite", r.status === 404);
r = await ana.call("POST", `/api/projects/${project.id}/invites`, { email: "someone-else@margin.test", role: "editor" });
const wrongInvite = r.data;
r = await ben.call("POST", `/api/invites/${wrongInvite.id}/accept`);
check("invite for another email is refused", r.status === 403, r.data?.error);
r = await ana.call("POST", `/api/projects/${project.id}/invites`, { role: "viewer" });
check("owner creates a link invite", r.status === 201 && r.data.url.includes("/invite/"));
const link = r.data;
r = await ben.call("POST", `/api/invites/${link.id}/accept`);
check("collaborator accepts", r.status === 200 && r.data.projectId === project.id);
r = await ben.call("POST", `/api/invites/${link.id}/accept`);
check("accepting twice is harmless", r.status === 200);

// Viewer: read, but no edits or comments
r = await ben.call("GET", `/api/tasks/${secret.id}`);
check("viewer can read", r.status === 200 && r.data.role === "viewer");
r = await ben.call("PATCH", `/api/tasks/${secret.id}`, { title: "nope" });
check("viewer can't edit", r.status === 403, r.data?.error);
r = await ben.call("POST", `/api/tasks/${secret.id}/comments`, { body: "hi" });
check("viewer can't comment", r.status === 403);
r = await ben.call("POST", `/api/tasks/${secret.id}/reminders`, { offsetMinutes: 0 });
check("viewer can set own reminder (needs a date)", r.status === 422 && /date/.test(r.data?.error ?? ""), `${r.status} ${r.data?.error}`);

// Promote to editor
r = await ben.call("PATCH", `/api/projects/${project.id}/members/${benId}`, { role: "editor" });
check("non-owner can't change roles", r.status === 403);
r = await ana.call("PATCH", `/api/projects/${project.id}/members/${benId}`, { role: "editor" });
check("owner promotes to editor", r.data?.members?.find((m) => m.userId === benId)?.role === "editor");
r = await ben.call("PATCH", `/api/tasks/${secret.id}`, { title: `Edited by ben ${tag}` });
check("editor can edit", r.status === 200);
r = await ben.call("PATCH", `/api/tasks/${secret.id}`, { projectId: null });
check("editor can't pull someone else's task into their Inbox", r.status === 403);
r = await ben.call("DELETE", `/api/projects/${project.id}`);
check("editor can't delete the project", r.status === 403);

// Assignment + comments + notifications
r = await ana.call("PATCH", `/api/tasks/${secret.id}`, { assigneeId: benId, dueDate: new Date().toLocaleDateString("en-CA") });
check("assign to a member", r.status === 200 && r.data.assigneeId === benId);
r = await ana.call("PATCH", `/api/tasks/${secret.id}`, { assigneeId: "not-a-member" });
check("can't assign to a non-member", r.status === 422);
r = await ben.call("GET", `/api/tasks?view=all`);
check("assigned task shows in assignee's lists", r.data.some((t) => t.id === secret.id));
r = await ben.call("POST", `/api/tasks/${secret.id}/comments`, { body: `On it ${tag}` });
check("editor comments", r.status === 201 && r.data.authorName);
const commentId = r.data.id;
r = await ana.call("GET", `/api/tasks/${secret.id}/comments`);
check("owner reads the comment", r.data.some((c) => c.id === commentId));
r = await ana.call("PATCH", `/api/comments/${commentId}`, { body: "rewrite" });
check("can't edit someone else's comment", r.status === 403);
r = await ana.call("GET", "/api/notifications");
check("owner notified of the comment", r.data.items.some((n) => n.kind === "comment" && n.body.includes(tag)));
r = await ben.call("GET", "/api/notifications");
check("assignee notified of the assignment", r.data.items.some((n) => n.kind === "assigned" && n.taskId === secret.id));

await new Promise((res) => setTimeout(res, 300));
check("collaborator received real-time change events", events.some((e) => e.type === "task" && e.id === secret.id), `${events.length} events`);
check("events carry no task contents", events.every((e) => !("title" in e)));

// Leaving removes access and unassigns
r = await ben.call("DELETE", `/api/projects/${project.id}/members/${benId}`);
check("member leaves", r.status === 200);
r = await ben.call("GET", `/api/tasks/${secret.id}`);
check("access gone after leaving", r.status === 404);
r = await ana.call("GET", `/api/tasks/${secret.id}`);
check("their assignment was cleared", r.data.task.assigneeId === null);
r = await ana.call("DELETE", `/api/projects/${project.id}/members/${(await ana.call("GET", "/api/auth/get-session")).data.user.id}`);
check("owner can't leave their own project", r.status === 422);

// API tokens
r = await ana.call("POST", "/api/tokens", { name: `smoke ${tag}` });
const token = r.data.token;
check("create API token (shown once)", r.status === 201 && token?.startsWith("mgn_"));
const bearer = { authorization: `Bearer ${token}`, cookie: "" };
r = await fetch(base + "/api/projects", { headers: { authorization: `Bearer ${token}` } });
check("token authenticates the API", r.status === 200);
r = await fetch(base + "/api/tokens", { headers: { authorization: `Bearer ${token}` } });
check("tokens can't manage tokens", r.status === 403);
r = await fetch(base + "/api/projects", { headers: { authorization: "Bearer mgn_bogus" } });
check("bad token is 401", r.status === 401);
const list = (await ana.call("GET", "/api/tokens")).data;
await ana.call("DELETE", `/api/tokens/${list.find((t) => t.name === `smoke ${tag}`).id}`);
r = await fetch(base + "/api/projects", { headers: { authorization: `Bearer ${token}` } });
check("revoked token stops working", r.status === 401);
void bearer;

// iCal
r = await ana.call("POST", "/api/ical");
check("enable iCal feed", r.data?.enabled && r.data.url.endsWith(".ics"));
const feedPath = new URL(r.data.url).pathname;
r = await fetch(base + feedPath);
const ics = await r.text();
check("feed serves a calendar", r.status === 200 && ics.startsWith("BEGIN:VCALENDAR") && r.headers.get("content-type").startsWith("text/calendar"));
await ana.call("POST", "/api/ical"); // rotate
r = await fetch(base + feedPath);
check("rotating the feed kills the old URL", r.status === 404);
await ana.call("DELETE", "/api/ical");

// Import / export
r = await ana.call("POST", "/api/import", { format: "text", dryRun: true, content: `Plan trip ${tag} #trips${tag} p2\n  Book flights ${tag} tomorrow\n- [x] Pack ${tag}\n` });
check("import dry run summarises", r.data?.tasks === 2 && r.data.subtasks === 1 && r.data.completed === 1 && r.data.newProjects.length === 1 && !r.data.imported, JSON.stringify(r.data));
r = await ana.call("POST", "/api/import", { format: "text", content: `Plan trip ${tag} #trips${tag} p2\n  Book flights ${tag} tomorrow\n` });
check("import text", r.data?.imported === true);
r = await ana.call("GET", `/api/search?q=${encodeURIComponent(`Book flights ${tag}`)}`);
check("imported subtask exists", r.data.length === 1 && r.data[0].parentId);
r = await ana.call("POST", "/api/import", { format: "csv", content: `Title,Due Date,Priority,Labels\n"Pay rent, ${tag}",2026-11-01,p1,"bills, home"\n` });
check("import CSV", r.data?.imported && r.data.tasks === 1);
r = await ana.call("POST", "/api/import", { format: "csv", content: "Foo,Bar\n1,2\n" });
check("CSV without a title column is explained", r.status === 422 && /title/i.test(r.data.error));
r = await fetch(base + "/api/export?format=csv", { headers: { cookie: ana.cookie() } });
const csv = await r.text();
check("CSV export", r.headers.get("content-disposition")?.includes(".csv") && csv.includes(`Pay rent, ${tag}`));
r = await ana.call("GET", "/api/export?format=json");
check("JSON export", r.data?.format === "margin-export" && r.data.tasks.some((t) => t.title === `Plan trip ${tag}`));

// Webhooks
r = await ana.call("POST", "/api/webhooks", { url: "http://127.0.0.1:9/hook", events: ["task.created"] });
check("webhook to a private address refused (unless allowed in dev)", r.status === 422 || r.status === 201, r.data?.error ?? "allowed in dev");
if (r.status === 201) await ana.call("DELETE", `/api/webhooks/${r.data.id}`);
r = await ana.call("POST", "/api/webhooks", { url: "https://example.com/margin-hook", events: ["task.bogus"] });
check("unknown webhook events rejected", r.status === 422);

// Tidy up
ctrl.abort();
await ana.call("DELETE", `/api/projects/${project.id}`);
for (const p of (await ana.call("GET", "/api/projects")).data.filter((p) => p.name.toLowerCase().includes(tag))) await ana.call("DELETE", `/api/projects/${p.id}`);
for (const h of (await ana.call("GET", `/api/search?q=${tag}`)).data) await ana.call("DELETE", `/api/tasks/${h.id}`);
console.log(failures ? `\n${failures} failed` : "\nAll sharing & integration checks passed.");
process.exit(failures ? 1 : 0);
