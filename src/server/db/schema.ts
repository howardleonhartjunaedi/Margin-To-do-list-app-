import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  date,
  index,
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
    /** Set for subtasks. One level deep in the UI; the schema doesn't forbid more. */
    parentId: text().references((): AnyPgColumn => task.id, { onDelete: "cascade" }),
    title: text().notNull(),
    notes: text().notNull().default(""),
    /** 1 = urgent … 4 = someday */
    priority: smallint().notNull().default(4),
    /** Calendar date in the user's own timezone (no instant). */
    dueDate: date({ mode: "string" }),
    /** Optional wall-clock time, "HH:MM". */
    dueTime: time({ precision: 0 }),
    /** RFC 5545 RRULE body, e.g. "FREQ=WEEKLY;BYDAY=MO". Scheduling lands in Phase 2. */
    recurrence: text(),
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
