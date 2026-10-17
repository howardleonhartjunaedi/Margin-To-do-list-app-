import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/*
 * Columns are camelCase in TypeScript and snake_case in Postgres (casing: "snake_case").
 * Auth tables follow Better Auth's core schema exactly; the adapter maps by these keys.
 */

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* ------------------------------ Auth ------------------------------ */

export const user = pgTable("user", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  ...timestamps,
});

export const session = pgTable(
  "session",
  {
    id: text().primaryKey(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    token: text().notNull().unique(),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index().on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text().primaryKey(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    ...timestamps,
  },
  (t) => [index().on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index().on(t.identifier)],
);

/* ------------------------------ Domain ------------------------------ */

/** Project colors are design tokens, never raw hex. See PROJECT_COLORS in src/lib/project-colors.ts. */
export const project = pgTable(
  "project",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text().notNull(),
    color: text().notNull().default("ink"),
    /** Fractional index (lexicographic) so reordering writes one row. */
    sortKey: text().notNull(),
    archivedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index().on(t.userId, t.sortKey)],
);

export const task = pgTable(
  "task",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** null = Inbox */
    projectId: text().references(() => project.id, { onDelete: "cascade" }),
    /** Who should do it, in a shared project. null = whoever created it. */
    assigneeId: text().references(() => user.id, { onDelete: "set null" }),
    /** Set for subtasks. One level deep in the UI; the schema doesn't forbid more. */
    parentId: text().references((): AnyPgColumn => task.id, { onDelete: "cascade" }),
    title: text().notNull(),
    notes: text().notNull().default(""),
    /** 1 = urgent … 4 = someday */
    priority: smallint().notNull().default(4),
    /** Optional start date; with dueDate it gives the task a span on the timeline. */
    startDate: date({ mode: "string" }),
    /** Calendar date in the user's own timezone (no instant). */
    dueDate: date({ mode: "string" }),
    /** Optional wall-clock time, "HH:MM". */
    dueTime: time({ precision: 0 }),
    /** RFC 5545 RRULE body, e.g. "FREQ=WEEKLY;BYDAY=MO". */
    recurrence: text(),
    /** Rough size of the task, for planning a day ("~30m"). */
    estimateMinutes: integer(),
    sortKey: text().notNull(),
    completedAt: timestamp({ withTimezone: true }),
    /** Soft delete so Undo can restore; purged by a job later. */
    deletedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    // Today / Upcoming: open tasks by date
    index("task_open_due_idx")
      .on(t.userId, t.dueDate)
      .where(sql`${t.completedAt} is null and ${t.deletedAt} is null and ${t.parentId} is null`),
    // Inbox / project lists in manual order
    index("task_list_idx").on(t.userId, t.projectId, t.sortKey),
    index("task_parent_idx").on(t.parentId),
    index("task_assignee_idx").on(t.assigneeId),
  ],
);

export const label = pgTable(
  "label",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text().notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("label_user_name_idx").on(t.userId, sql`lower(${t.name})`)],
);

export const taskLabel = pgTable(
  "task_label",
  {
    taskId: text()
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    labelId: text()
      .notNull()
      .references(() => label.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.labelId] }), index().on(t.labelId)],
);

/* ------------------------------ Reminders & notifications ------------------------------ */

export const userSettings = pgTable("user_settings", {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  /** IANA zone; every wall-clock rule (due times, quiet hours, digest) is read in it. */
  timeZone: text().notNull().default("UTC"),
  /** When a date-only task is "due", for reminder purposes. */
  dayTime: text().notNull().default("09:00"),
  /** Added automatically when a task gets a time. null = none. */
  defaultReminderMinutes: integer(),
  quietEnabled: boolean().notNull().default(false),
  quietStart: text().notNull().default("22:00"),
  quietEnd: text().notNull().default("07:00"),
  pushEnabled: boolean().notNull().default(true),
  emailEnabled: boolean().notNull().default(false),
  digestEnabled: boolean().notNull().default(false),
  digestTime: text().notNull().default("08:00"),
  lastDigestOn: date({ mode: "string" }),
  /** Secret for the private iCal feed URL. null until the user turns the feed on. */
  icalToken: text().unique(),
  ...timestamps,
});

export const reminder = pgTable(
  "reminder",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    taskId: text()
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    /** Relative: minutes before the task's due moment. */
    offsetMinutes: integer(),
    /** Absolute: a fixed instant. Exactly one of offsetMinutes / at is set. */
    at: timestamp({ withTimezone: true }),
    /** Next time the scheduler should act. Moves on snooze and quiet-hours deferral. null = can't fire (no due date). */
    fireAt: timestamp({ withTimezone: true }),
    /** pending → sending → sent | skipped | failed. dismissed by the user. */
    status: text().notNull().default("pending"),
    attempts: smallint().notNull().default(0),
    sentAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("reminder_due_idx").on(t.fireAt).where(sql`${t.status} = 'pending'`),
    index().on(t.taskId),
  ],
);

export const notification = pgTable(
  "notification",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    taskId: text().references(() => task.id, { onDelete: "set null" }),
    reminderId: text().references(() => reminder.id, { onDelete: "set null" }),
    kind: text().notNull(), // "reminder" | "digest"
    title: text().notNull(),
    body: text().notNull().default(""),
    readAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId, t.createdAt)],
);

export const pushSubscription = pgTable("push_subscription", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  endpoint: text().notNull().unique(),
  p256dh: text().notNull(),
  auth: text().notNull(),
  userAgent: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** One row per completion — recurring tasks complete many times. Feeds stats in Phase 4. */
export const completion = pgTable(
  "completion",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    taskId: text()
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    dueDate: date({ mode: "string" }),
    completedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId, t.completedAt)],
);

/** A named filter in the sidebar. `query` uses the same encoding as the ?f= URL param (src/lib/filters.ts). */
export const savedFilter = pgTable(
  "saved_filter",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text().notNull(),
    query: text().notNull(),
    sortKey: text().notNull(),
    ...timestamps,
  },
  (t) => [index().on(t.userId, t.sortKey)],
);

/* ------------------------------ Productivity ------------------------------ */

/** A finished (or abandoned) focus or break interval. Running timers live on the client. */
export const focusSession = pgTable(
  "focus_session",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    taskId: text().references(() => task.id, { onDelete: "set null" }),
    kind: text().notNull().default("focus"), // "focus" | "break"
    plannedSeconds: integer().notNull(),
    actualSeconds: integer().notNull(),
    completed: boolean().notNull(), // ran to the end vs stopped early
    startedAt: timestamp({ withTimezone: true }).notNull(),
    endedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [index().on(t.userId, t.startedAt)],
);

export const habit = pgTable(
  "habit",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text().notNull(),
    color: text().notNull().default("ink"),
    /** Days per week to count as "kept": 7 = daily, 3 = three times a week. */
    targetPerWeek: smallint().notNull().default(7),
    sortKey: text().notNull(),
    archivedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index().on(t.userId, t.sortKey)],
);

export const habitCheck = pgTable(
  "habit_check",
  {
    habitId: text()
      .notNull()
      .references(() => habit.id, { onDelete: "cascade" }),
    date: date({ mode: "string" }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.habitId, t.date] })],
);

/** One row per user per local day: the morning plan and the evening review. */
export const dailyNote = pgTable(
  "daily_note",
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date({ mode: "string" }).notNull(),
    intention: text().notNull().default(""),
    reflection: text().notNull().default(""),
    /** Hours the user said they have for tasks today. */
    capacityMinutes: integer(),
    plannedAt: timestamp({ withTimezone: true }),
    reviewedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);

/* ------------------------------ Collaboration ------------------------------ */

/**
 * Who can see a project, and what they can do. The creator is always a member with role "owner".
 *   owner     everything, including sharing and deleting the project
 *   editor    add, edit, complete, move and delete tasks; comment
 *   commenter read and comment
 *   viewer    read only
 */
export const projectMember = pgTable(
  "project_member",
  {
    projectId: text()
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userId] }), index().on(t.userId)],
);

/** An invitation link. The id is the secret token in the URL. */
export const projectInvite = pgTable(
  "project_invite",
  {
    id: text().primaryKey(),
    projectId: text()
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    email: text(),
    role: text().notNull(),
    invitedBy: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    acceptedAt: timestamp({ withTimezone: true }),
    acceptedBy: text().references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.projectId)],
);

export const comment = pgTable(
  "comment",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    taskId: text()
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    editedAt: timestamp({ withTimezone: true }),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index().on(t.taskId, t.createdAt)],
);

/* ------------------------------ Integrations ------------------------------ */

/** Personal access token for the REST API. Only a SHA-256 hash is stored. */
export const apiToken = pgTable(
  "api_token",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text().notNull(),
    /** First characters of the token, so people can tell tokens apart. */
    prefix: text().notNull(),
    tokenHash: text().notNull().unique(),
    lastUsedAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId)],
);

export const webhook = pgTable(
  "webhook",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    url: text().notNull(),
    /** HMAC-SHA256 signing secret; shown to the user once. */
    secret: text().notNull(),
    /** Comma-separated event names, or "*". */
    events: text().notNull().default("*"),
    active: boolean().notNull().default(true),
    failureCount: integer().notNull().default(0),
    lastStatus: integer(),
    lastDeliveryAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId)],
);

export const webhookDelivery = pgTable(
  "webhook_delivery",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    webhookId: text()
      .notNull()
      .references(() => webhook.id, { onDelete: "cascade" }),
    event: text().notNull(),
    payload: text().notNull(),
    /** pending → sending → sent | failed */
    status: text().notNull().default("pending"),
    attempts: smallint().notNull().default(0),
    nextAttemptAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    responseStatus: integer(),
    error: text(),
    deliveredAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("webhook_delivery_due_idx").on(t.nextAttemptAt).where(sql`${t.status} = 'pending'`),
    index().on(t.webhookId, t.createdAt),
  ],
);

/* ------------------------------ Relations ------------------------------ */

export const projectRelations = relations(project, ({ many }) => ({ tasks: many(task) }));

export const taskRelations = relations(task, ({ one, many }) => ({
  project: one(project, { fields: [task.projectId], references: [project.id] }),
  parent: one(task, { fields: [task.parentId], references: [task.id], relationName: "subtasks" }),
  subtasks: many(task, { relationName: "subtasks" }),
  labels: many(taskLabel),
}));

export const taskLabelRelations = relations(taskLabel, ({ one }) => ({
  task: one(task, { fields: [taskLabel.taskId], references: [task.id] }),
  label: one(label, { fields: [taskLabel.labelId], references: [label.id] }),
}));

export type TaskRow = typeof task.$inferSelect;
export type ProjectRow = typeof project.$inferSelect;
export type ReminderRow = typeof reminder.$inferSelect;
export type SettingsRow = typeof userSettings.$inferSelect;
