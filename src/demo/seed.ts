// Sample data for the demo account: a believable week, so every view has something to show.
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { DEMO_USER } from "./user";
import type { Call } from "./worker";

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("sv"); // YYYY-MM-DD, local
};
const at = (offset: number, hour: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, 15, 0, 0);
  return d;
};

type T = { title: string; project?: string; priority?: 1 | 2 | 3 | 4; due?: number; time?: string; repeat?: string; estimate?: number; labels?: string[]; notes?: string; sub?: string[] };

const projects = [
  { key: "home", name: "Home", color: "success" },
  { key: "work", name: "Work", color: "accent" },
  { key: "health", name: "Health", color: "p2" },
  { key: "trip", name: "Lisbon trip", color: "p3" },
] as const;

const open: T[] = [
  { title: "Call the plumber about the kitchen tap", project: "home", priority: 1, due: 0, time: "14:00", labels: ["calls"] },
  { title: "Draft the Q4 budget", project: "work", priority: 1, due: 0, estimate: 120, notes: "Start from last year's numbers; flag anything over 10%.", sub: ["Collect team requests", "Compare with Q3 actuals", "Send draft to Maya"] },
  { title: "Review Sam's pull request", project: "work", priority: 2, due: 0, estimate: 30 },
  { title: "Water the plants", project: "home", due: 0, repeat: "FREQ=DAILY;INTERVAL=3" },
  { title: "Book the dentist", project: "health", priority: 2, due: -1, labels: ["calls"] },
  { title: "Weekly team sync", project: "work", due: 1, time: "10:00", repeat: "FREQ=WEEKLY" },
  { title: "Pick up dry cleaning", project: "home", due: 1, labels: ["errands"] },
  { title: "Run 5k", project: "health", due: 2, time: "07:00", estimate: 35 },
  { title: "Book flights to Lisbon", project: "trip", priority: 2, due: 3, sub: ["Compare TAP and easyJet", "Check baggage rules"] },
  { title: "Find a place to stay in Alfama", project: "trip", due: 5 },
  { title: "Prepare the quarterly review deck", project: "work", priority: 2, due: 4, estimate: 90 },
  { title: "Pay the electricity bill", project: "home", priority: 1, due: 6, labels: ["bills"] },
  { title: "Call mum", due: 2, labels: ["family"] },
  { title: "Renew passport", project: "trip", priority: 3, due: 12 },
  { title: "Read chapter four", estimate: 45 },
  { title: "Buy a birthday present for Alex", labels: ["errands"] },
  { title: "Try the new ramen place" },
];

const finished: { title: string; project?: string; daysAgo: number }[] = [
  { title: "Send the invoice to Northwind", project: "work", daysAgo: 0 },
  { title: "Grocery run", project: "home", daysAgo: 1 },
  { title: "Fix the login bug", project: "work", daysAgo: 1 },
  { title: "Yoga class", project: "health", daysAgo: 2 },
  { title: "Write the onboarding doc", project: "work", daysAgo: 2 },
  { title: "Clean the bathroom", project: "home", daysAgo: 3 },
  { title: "Reply to the landlord", project: "home", daysAgo: 4 },
  { title: "1:1 with Maya", project: "work", daysAgo: 4 },
  { title: "Renew gym membership", project: "health", daysAgo: 5 },
  { title: "Ship the release notes", project: "work", daysAgo: 6 },
];

export async function seed(call: Call) {
  const now = new Date();
  await db.insert(schema.user).values({ ...DEMO_USER, emailVerified: true, createdAt: now, updatedAt: now });

  const ids: Record<string, string> = {};
  for (const p of projects) {
    const created = (await (await call("POST", "/api/projects", { name: p.name, color: p.color })).json()) as { id: string };
    ids[p.key] = created.id;
  }

  for (const t of open) {
    const res = await call("POST", "/api/tasks", {
      title: t.title,
      projectId: t.project ? ids[t.project] : null,
      priority: t.priority,
      dueDate: t.due === undefined ? null : day(t.due),
      dueTime: t.time ?? null,
      recurrence: t.repeat ?? null,
      estimateMinutes: t.estimate ?? null,
      labels: t.labels,
      notes: t.notes,
    });
    const { id } = (await res.json()) as { id: string };
    for (const s of t.sub ?? []) await call("POST", "/api/tasks", { title: s, parentId: id, projectId: t.project ? ids[t.project] : null });
  }

  for (const f of finished) {
    const { id } = (await (await call("POST", "/api/tasks", { title: f.title, projectId: f.project ? ids[f.project] : null, dueDate: day(-f.daysAgo) })).json()) as { id: string };
    await call("PATCH", `/api/tasks/${id}`, { completed: true });
    const when = at(-f.daysAgo, 9 + (f.title.length % 8));
    await db.update(schema.task).set({ completedAt: when }).where(eq(schema.task.id, id));
    await db.update(schema.completion).set({ completedAt: when }).where(eq(schema.completion.taskId, id));
  }

  const habits = [
    { name: "Meditate", color: "accent", targetPerWeek: 7, done: [0, 1, 2, 3, 5, 6, 8, 9] },
    { name: "Stretch", color: "success", targetPerWeek: 5, done: [1, 2, 4, 5, 7] },
    { name: "No phone after 10pm", color: "p3", targetPerWeek: 4, done: [0, 2, 3, 6] },
  ];
  for (const h of habits) {
    // The habits endpoint answers with the whole list, so name the new habit's id up front.
    const id = crypto.randomUUID();
    await call("POST", "/api/habits", { id, name: h.name, color: h.color, targetPerWeek: h.targetPerWeek });
    for (const d of h.done) await call("PUT", `/api/habits/${id}/checks`, { date: day(-d), done: true });
    await db.update(schema.habit).set({ createdAt: at(-21, 8) }).where(eq(schema.habit.id, id)); // a few weeks of history
  }

  for (const [daysAgo, hour, minutes] of [[0, 9, 25], [1, 10, 50], [1, 15, 25], [2, 9, 25], [3, 11, 45], [4, 14, 25], [5, 9, 50]]) {
    const start = at(-daysAgo, hour);
    const end = new Date(start.getTime() + minutes * 60_000);
    await call("POST", "/api/focus", { kind: "focus", plannedSeconds: minutes * 60, actualSeconds: minutes * 60, completed: true, startedAt: start.toISOString(), endedAt: end.toISOString() });
  }
}
