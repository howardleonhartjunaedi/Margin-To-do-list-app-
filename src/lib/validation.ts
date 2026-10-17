import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
const priority = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
const title = z.string().trim().min(1, "A task needs a title.").max(500);
const labels = z.array(z.string().trim().min(1).max(40)).max(20);
const rrule = z.string().regex(/^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;[A-Z]+=[A-Z0-9,+-]+)*$/).max(200);

export const createTaskSchema = z.object({
  id: z.uuid().optional(), // client-generated, so optimistic rows keep their identity
  title,
  notes: z.string().max(20_000).optional(),
  projectId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  priority: priority.optional(),
  startDate: isoDate.nullable().optional(),
  dueDate: isoDate.nullable().optional(),
  dueTime: hhmm.nullable().optional(),
  recurrence: rrule.nullable().optional(),
  labels: labels.optional(),
});

export const updateTaskSchema = z
  .object({
    title,
    notes: z.string().max(20_000),
    projectId: z.string().nullable(),
    priority,
    startDate: isoDate.nullable(),
    dueDate: isoDate.nullable(),
    dueTime: hhmm.nullable(),
    recurrence: rrule.nullable(),
    labels,
    sortKey: z.string().min(1).max(200),
    completed: z.boolean(),
    deleted: z.boolean(),
  })
  .partial();

export const projectColor = z.enum(["ink", "accent", "p1", "p2", "p3", "success"]);

export const createProjectSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "A project needs a name — even a short one.").max(120),
  color: projectColor.optional(),
});

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    color: projectColor,
    sortKey: z.string().min(1).max(200),
    archived: z.boolean(),
  })
  .partial();

export const viewQuerySchema = z.discriminatedUnion("view", [
  z.object({ view: z.literal("inbox") }),
  z.object({ view: z.literal("today"), today: isoDate }),
  z.object({ view: z.literal("upcoming"), today: isoDate, to: isoDate }),
  z.object({ view: z.literal("project"), id: z.string().min(1) }),
  z.object({ view: z.literal("range"), from: isoDate, to: isoDate, projectId: z.string().min(1).optional() }),
  z.object({ view: z.literal("all") }),
]);

export const savedFilterSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Give the filter a name.").max(80),
  query: z.string().max(1000),
});

export const createReminderSchema = z.union([
  z.object({ offsetMinutes: z.number().int().min(-10_080).max(43_200) }), // up to a week after / 30 days before
  z.object({ at: z.iso.datetime({ offset: true }) }),
]);

export const snoozeSchema = z.union([
  z.object({ minutes: z.number().int().min(1).max(10_080) }),
  z.object({ tomorrowAt: hhmm }),
]);

export const settingsSchema = z
  .object({
    timeZone: z.string().refine((tz) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "That isn’t a time zone we recognise."),
    dayTime: hhmm,
    defaultReminderMinutes: z.number().int().min(0).max(10_080).nullable(),
    quietEnabled: z.boolean(),
    quietStart: hhmm,
    quietEnd: hhmm,
    pushEnabled: z.boolean(),
    emailEnabled: z.boolean(),
    digestEnabled: z.boolean(),
    digestTime: hhmm,
  })
  .partial();

export const pushSubscriptionSchema = z.object({
  endpoint: z.url().max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(500), auth: z.string().min(1).max(500) }),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
