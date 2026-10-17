import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "API guide", description: "Use Margin from scripts and other apps." };

const ENDPOINTS: [string, string, string][] = [
  ["GET", "/api/tasks?view=inbox", "Inbox tasks. Other views: today&today=YYYY-MM-DD, upcoming&today=…&to=…, project&id=…, range&from=…&to=…[&projectId=…], all"],
  ["POST", "/api/tasks", "Create a task. Body: title (required), notes, projectId, parentId, assigneeId, priority 1–4, startDate, dueDate, dueTime HH:MM, recurrence (RRULE), estimateMinutes, labels[]"],
  ["GET", "/api/tasks/:id", "A task with its subtasks, your reminders, focus time and your role"],
  ["PATCH", "/api/tasks/:id", "Change any field above, plus completed: true|false, deleted: true|false, sortKey"],
  ["DELETE", "/api/tasks/:id", "Delete (restorable with PATCH deleted: false)"],
  ["GET", "/api/tasks/:id/comments", "Comments on a task"],
  ["POST", "/api/tasks/:id/comments", "Add a comment. Body: body"],
  ["GET", "/api/projects", "Projects you’re a member of, with your role"],
  ["POST", "/api/projects", "Create a project. Body: name, color"],
  ["GET", "/api/projects/:id/members", "Members and, for owners, pending invitations"],
  ["GET", "/api/search?q=…", "Search titles and notes"],
  ["GET", "/api/export?format=json|csv", "Everything you can see, as a file"],
  ["POST", "/api/import", "Body: format (json|csv|text), content, dryRun"],
  ["GET", "/api/stats?from=…&to=…", "Completions and focus by day, hour and project"],
];

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md bg-sunken p-4 font-mono text-xs leading-5 text-ink" data-lenis-prevent>
      <code>{children}</code>
    </pre>
  );
}

export default function DevelopersPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8">
      <header className="flex items-center gap-4">
        <Link href="/" className="font-display text-xl font-medium tracking-tight text-ink">
          Margin<span className="text-accent">.</span>
        </Link>
        <span className="font-mono text-2xs text-ink-3">/developers</span>
      </header>
      <main className="py-12">
        <h1 className="font-display text-4xl text-ink">API guide</h1>
        <p className="mt-4 max-w-[60ch] text-base text-ink-2">
          Everything the app does goes through the same JSON API, so anything you can do in Margin you can do from a script.
        </p>

        <section className="mt-12 border-t border-line pt-6">
          <h2 className="font-display text-2xl text-ink">Authentication</h2>
          <p className="mt-3 max-w-[60ch] text-sm text-ink-2">
            Create a personal token in <Link href="/settings" className="text-accent underline underline-offset-4">Settings → API</Link>, then send it as a bearer token.
            Tokens act as you, with your projects and permissions. Revoke one any time.
          </p>
          <div className="mt-4">
            <Code>{`curl https://your-margin.example/api/tasks?view=inbox \\
  -H "Authorization: Bearer mgn_…"`}</Code>
          </div>
          <p className="mt-3 text-sm text-ink-2">
            Limits: 120 requests a minute per token. Over that you get <span className="font-mono text-xs">429</span> with a{" "}
            <span className="font-mono text-xs">Retry-After</span> header.
          </p>
        </section>

        <section className="mt-12 border-t border-line pt-6">
          <h2 className="font-display text-2xl text-ink">Endpoints</h2>
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-3">
                <th className="py-2 pr-3 font-normal">Method</th>
                <th className="py-2 pr-3 font-normal">Path</th>
                <th className="py-2 font-normal">What it does</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map(([m, p, d]) => (
                <tr key={m + p} className="border-b border-line/60 align-top">
                  <td className="py-2 pr-3 font-mono text-2xs text-ink">{m}</td>
                  <td className="py-2 pr-3 font-mono text-2xs break-all text-ink">{p}</td>
                  <td className="py-2 text-xs text-ink-2">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-sm text-ink-2">Errors come back as JSON with a human-readable message:</p>
          <div className="mt-2">
            <Code>{`HTTP/1.1 422
{ "error": "A task can’t start after it’s due." }`}</Code>
          </div>
          <p className="mt-3 text-xs text-ink-3">
            401 not signed in · 403 your role doesn’t allow it · 404 doesn’t exist or isn’t shared with you · 422 invalid input · 429 slow down.
          </p>
        </section>

        <section className="mt-12 border-t border-line pt-6">
          <h2 className="font-display text-2xl text-ink">Example: add a task</h2>
          <div className="mt-4">
            <Code>{`curl -X POST https://your-margin.example/api/tasks \\
  -H "Authorization: Bearer mgn_…" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Renew passport","dueDate":"2026-11-01","priority":1}'`}</Code>
          </div>
        </section>

        <section className="mt-12 border-t border-line pt-6">
          <h2 className="font-display text-2xl text-ink">Webhooks</h2>
          <p className="mt-3 max-w-[60ch] text-sm text-ink-2">
            Add an https endpoint in Settings and choose events: <span className="font-mono text-xs">task.created</span>,{" "}
            <span className="font-mono text-xs">task.updated</span>, <span className="font-mono text-xs">task.completed</span>,{" "}
            <span className="font-mono text-xs">task.deleted</span>, <span className="font-mono text-xs">comment.created</span>. Each delivery is a POST with a JSON
            body and three headers: <span className="font-mono text-xs">X-Margin-Event</span>, <span className="font-mono text-xs">X-Margin-Delivery</span> (unique;
            use it to ignore repeats) and <span className="font-mono text-xs">X-Margin-Signature</span>.
          </p>
          <p className="mt-3 text-sm text-ink-2">Reply with any 2xx within five seconds. Anything else is retried six times over about half an hour.</p>
          <p className="mt-3 text-sm text-ink-2">Verify the signature with your endpoint’s secret before trusting the body:</p>
          <div className="mt-2">
            <Code>{`import { createHmac, timingSafeEqual } from "node:crypto";

// header: "t=1760000000,v1=<hex>"   rawBody: the exact bytes you received
function verify(secret, rawBody, header) {
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false; // replayed or stale
  const expected = createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest();
  const given = Buffer.from(v1, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}`}</Code>
          </div>
          <p className="mt-3 text-sm text-ink-2">A delivery body looks like this:</p>
          <div className="mt-2">
            <Code>{`{
  "id": "6f1c…",                 // same as X-Margin-Delivery
  "event": "task.completed",
  "createdAt": "2026-10-18T09:30:00.000Z",
  "data": { "task": { "id": "…", "title": "…", … }, "actorId": "…", "changes": ["completed"] }
}`}</Code>
          </div>
        </section>

        <section className="mt-12 border-t border-line pt-6">
          <h2 className="font-display text-2xl text-ink">Calendar feed</h2>
          <p className="mt-3 max-w-[60ch] text-sm text-ink-2">
            Settings → Calendar feed gives you a private iCalendar (.ics) URL with your dated tasks. Timed tasks use your time zone and last as long as their
            estimate; repeating tasks carry their recurrence rule.
          </p>
        </section>
      </main>
    </div>
  );
}
