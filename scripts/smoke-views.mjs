// Phase 3 API checks: date-range and all-task views, start/due spans, search, saved filters.
// Run: node scripts/smoke-views.mjs [baseUrl]   (dev account from .env.local)
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
const day = (n) => new Date(Date.now() + n * 86_400_000).toLocaleDateString("en-CA");
const tag = `zq${Date.now() % 100000}`;

await call("POST", "/api/auth/sign-in/email", { email: env.DEV_USER_EMAIL, password: env.DEV_USER_PASSWORD });

const ids = [];
const mk = async (body) => {
  const r = await call("POST", "/api/tasks", { id: crypto.randomUUID(), ...body });
  if (r.status === 201) ids.push(r.data.id);
  return r;
};

let r = await mk({ title: `Span ${tag}`, startDate: day(2), dueDate: day(6) });
check("create task with start–due span", r.status === 201 && r.data.startDate === day(2), r.data?.startDate);
const span = r.data;
r = await mk({ title: `Bad span ${tag}`, startDate: day(5), dueDate: day(1) });
check("rejects start after due", r.status === 422, r.data?.error);
r = await mk({ title: `Start only ${tag}`, startDate: day(1) });
check("rejects start without due", r.status === 422, r.data?.error);
await mk({ title: `Undated ${tag}`, notes: `has the word ${tag}-needle inside` });
await mk({ title: `Later ${tag}`, dueDate: day(40) });

r = await call("GET", `/api/tasks?view=range&from=${day(4)}&to=${day(5)}`);
check("range includes overlapping spans", r.data?.some((t) => t.id === span.id));
r = await call("GET", `/api/tasks?view=range&from=${day(7)}&to=${day(9)}`);
check("range excludes spans that ended", !r.data?.some((t) => t.id === span.id));
r = await call("GET", `/api/tasks?view=all`);
const mine = r.data?.filter((t) => t.title.includes(tag)) ?? [];
check("all view returns every open task, undated last", mine.length === 3 && mine.at(-1).title.startsWith("Undated"), mine.map((t) => t.title).join(", "));

r = await call("PATCH", `/api/tasks/${span.id}`, { dueDate: null });
check("clearing due clears start", r.data?.startDate === null && r.data?.dueDate === null);

r = await call("GET", `/api/search?q=${encodeURIComponent(tag)}`);
check("search ranks title matches first", r.data?.length >= 3 && r.data[0].field === "title", `${r.data?.length} hits`);
r = await call("GET", `/api/search?q=${encodeURIComponent(`${tag}-needle`)}`);
check("search finds notes with a snippet", r.data?.[0]?.field === "notes" && r.data[0].snippet?.includes("needle"), r.data?.[0]?.snippet);
r = await call("GET", `/api/search?q=${encodeURIComponent("%_")}`);
check("search escapes LIKE wildcards", r.status === 200 && Array.isArray(r.data), `${r.data?.length} hits`);

r = await call("POST", "/api/filters", { id: crypto.randomUUID(), name: `Urgent ${tag}`, query: "p:1;d:overdue,today" });
check("create saved filter", r.status === 201);
const fid = r.data.id;
r = await call("PATCH", `/api/filters/${fid}`, { name: `Renamed ${tag}` });
check("rename saved filter", r.data?.name === `Renamed ${tag}`);
r = await call("GET", "/api/filters");
check("list saved filters", r.data?.some((f) => f.id === fid));
r = await call("DELETE", `/api/filters/${fid}`);
check("delete saved filter", r.status === 200);

for (const id of ids) await call("DELETE", `/api/tasks/${id}`);
console.log(failures ? `\n${failures} failed` : "\nAll view checks passed.");
process.exit(failures ? 1 : 0);
