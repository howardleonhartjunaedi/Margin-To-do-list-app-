import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { instantToZoned } from "@/lib/time/zone";
import { atLeast, type Role } from "./access";
import { db } from "./db";
import { cleanSteps, cleanTriage } from "./ai-results";
import { ClientError } from "./errors";
import { getSettings } from "./reminders";
import { getTaskWithSubtasks, listProjects, listTasks } from "./tasks";

/*
 * AI suggestions. Two jobs, both "suggest, then the user decides":
 *   breakdown — a task becomes a short list of concrete next steps (added as subtasks on accept)
 *   triage    — Inbox tasks get a suggested project, date and priority (applied one by one on accept)
 * Nothing is written here; the client applies accepted suggestions through the normal task API.
 *
 * Requires ANTHROPIC_API_KEY on the server, and the user's own consent (Settings → AI suggestions).
 * Only the task text involved in a request is sent.
 */

const MODEL = process.env.AI_MODEL ?? "claude-opus-5-5";
const PER_HOUR = 30;

export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

const recent = new Map<string, number[]>();
function rateLimit(userId: string) {
  const now = Date.now();
  const calls = (recent.get(userId) ?? []).filter((t) => now - t < 3_600_000);
  if (calls.length >= PER_HOUR) throw new ClientError("That’s a lot of suggestions for one hour. Try again a little later.", 429);
  calls.push(now);
  recent.set(userId, calls);
}

async function requireAi(userId: string) {
  if (!aiConfigured()) throw new ClientError("AI suggestions aren’t set up on this server.", 503);
  const s = await getSettings(db, userId);
  if (!s.aiEnabled) throw new ClientError("Turn on AI suggestions in Settings first.", 403);
  rateLimit(userId);
  return s;
}

const LANGUAGE: Record<string, string> = { en: "English", id: "Indonesian" };
/** The language the user is reading: their saved choice, else the one on screen. */
const languageFor = (locale: string | null | undefined) => LANGUAGE[locale ?? "en"] ?? "English";

async function ask<T extends z.ZodType>(schema: T, system: string, prompt: string): Promise<z.infer<T>> {
  try {
    const res = await anthropic().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // A policy decline on the main model retries on its default fallback inside the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      // Short, well-specified jobs: low effort keeps them quick without hurting quality.
      output_config: { effort: "low", format: betaZodOutputFormat(schema) },
      system,
      messages: [{ role: "user", content: prompt }],
    });
    if (res.stop_reason === "refusal") throw new ClientError("The assistant couldn’t help with this one.", 422);
    if (!res.parsed_output) throw new ClientError("The suggestion came back incomplete. Try again.", 502);
    return res.parsed_output as z.infer<T>;
  } catch (e) {
    if (e instanceof ClientError) throw e;
    if (e instanceof Anthropic.RateLimitError) throw new ClientError("The assistant is busy right now. Try again in a minute.", 503);
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
      throw new ClientError("AI suggestions aren’t configured correctly on this server.", 503);
    if (e instanceof Anthropic.APIError) throw new ClientError("The assistant isn’t responding. Try again shortly.", 502);
    throw e;
  }
}

/* ------------------------------ Breakdown ------------------------------ */

const BreakdownSchema = z.object({
  steps: z.array(
    z.object({
      title: z.string().describe("A concrete next action, imperative, under 80 characters"),
      estimateMinutes: z.number().int().nullable().describe("Rough minutes for this step, or null if unclear"),
    }),
  ),
});

export async function breakdownTask(userId: string, taskId: string, uiLocale?: string) {
  const s = await requireAi(userId);
  const lang = languageFor(s.locale ?? uiLocale);
  const { task, subtasks, role } = await getTaskWithSubtasks(userId, taskId);
  if (!atLeast(role as Role, "editor")) throw new ClientError("You can view this task but not add steps to it.", 403);

  const out = await ask(
    BreakdownSchema,
    `You help people break a task into its next concrete steps in a personal task manager.
Return 3 to 7 steps, in the order they'd be done. Each step is a physical, specific action someone could start right now ("Email Sam for the floor plan", not "Plan"). Keep titles short and plain. Don't repeat steps the task already has. Write in ${lang}, matching the task's own language if it differs.`,
    [
      `Task: ${task.title}`,
      task.notes ? `Notes: ${task.notes.slice(0, 2000)}` : null,
      subtasks.length ? `Steps it already has:\n${subtasks.map((t) => `- ${t.title}`).join("\n")}` : null,
    ]
      .filter(Boolean)
      .join("\n\n"),
  );

  return { steps: cleanSteps(out.steps) };
}

/* ------------------------------ Inbox triage ------------------------------ */

const TriageSchema = z.object({
  suggestions: z.array(
    z.object({
      taskId: z.string(),
      projectId: z.string().nullable().describe("One of the given project ids, or null to leave it in the Inbox"),
      dueDate: z.string().nullable().describe("YYYY-MM-DD only when the task clearly implies a date; otherwise null"),
      priority: z.number().int().describe("1 (urgent) to 4 (none)"),
      reason: z.string().describe("Why, in under 12 words"),
    }),
  ),
});

export async function triageInbox(userId: string, uiLocale?: string) {
  const s = await requireAi(userId);
  const lang = languageFor(s.locale ?? uiLocale);
  const today = instantToZoned(new Date(), s.timeZone).date;
  const inbox = (await listTasks(userId, { view: "inbox" })).filter((t) => !t.dueDate && !t.parentId).slice(0, 30);
  if (!inbox.length) return { suggestions: [] };
  const projects = (await listProjects(userId)).filter((p) => atLeast(p.role, "editor")); // already excludes archived

  // Short handles instead of UUIDs: fewer tokens, and nothing to mistype.
  const taskRef = new Map(inbox.map((t, i) => [`t${i + 1}`, t]));
  const projectRef = new Map(projects.map((p, i) => [`p${i + 1}`, p]));

  const out = await ask(
    TriageSchema,
    `You sort a person's Inbox in a task manager. For each task, suggest where it belongs: one of their projects (by id) or null to leave it in the Inbox, a due date only when the wording clearly implies one (today is ${today}), and a priority from 1 (urgent) to 4 (none — the usual answer). Be conservative: when unsure, leave fields null and priority 4. Give a short reason in ${lang}. Return one suggestion per task id given.`,
    [
      `Projects:\n${[...projectRef].map(([ref, p]) => `${ref}: ${p.name}`).join("\n") || "(none)"}`,
      `Inbox:\n${[...taskRef].map(([ref, t]) => `${ref}: ${t.title}${t.labels.length ? ` [${t.labels.map((l) => `@${l}`).join(" ")}]` : ""}`).join("\n")}`,
    ].join("\n\n"),
  );

  return { suggestions: cleanTriage(out.suggestions, taskRef, projectRef, today) };
}
