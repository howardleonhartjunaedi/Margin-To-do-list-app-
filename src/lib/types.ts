import type { ISODate } from "./dates";

export type Priority = 1 | 2 | 3 | 4;

/** A task as the client sees it. */
export interface Task {
  id: string;
  /** The user who added it. */
  createdBy: string;
  projectId: string | null;
  parentId: string | null;
  assigneeId: string | null;
  title: string;
  notes: string;
  priority: Priority;
  startDate: ISODate | null;
  dueDate: ISODate | null;
  dueTime: string | null; // "HH:MM"
  recurrence: string | null; // RRULE body
  estimateMinutes: number | null;
  sortKey: string;
  completedAt: string | null;
  createdAt: string;
  labels: string[];
  subtaskCount: number;
  subtaskDone: number;
  commentCount: number;
}

export type Role = "viewer" | "commenter" | "editor" | "owner";

export interface Member {
  userId: string;
  name: string;
  email: string;
  role: Role;
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  authorName: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
}

export interface Project {
  id: string;
  name: string;
  color: ProjectColor;
  sortKey: string;
  openCount: number;
  role: Role;
  memberCount: number;
}

export type ProjectColor = "ink" | "accent" | "p1" | "p2" | "p3" | "success";

export interface Counts {
  inbox: number;
  today: number;
  overdue: number;
  labels: string[];
}

export interface ReminderInfo {
  id: string;
  offsetMinutes: number | null;
  at: string | null;
  fireAt: string | null;
  status: "pending" | "sending" | "sent" | "skipped" | "failed" | "dismissed";
}

export interface Notification {
  id: string;
  kind: "reminder" | "digest" | "comment" | "assigned";
  title: string;
  body: string;
  taskId: string | null;
  reminderId: string | null;
  createdAt: string;
  read: boolean;
  taskDone: boolean;
}

export interface Settings {
  timeZone: string;
  dayTime: string;
  defaultReminderMinutes: number | null;
  quietEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  pushEnabled: boolean;
  emailEnabled: boolean;
  digestEnabled: boolean;
  digestTime: string;
  locale: string | null;
  aiEnabled: boolean;
}

export type View =
  | { kind: "inbox" }
  | { kind: "today"; today: ISODate }
  | { kind: "upcoming"; today: ISODate; to: ISODate }
  | { kind: "project"; id: string }
  /** Open tasks whose date (or start–due span) touches [from, to], optionally one project. */
  | { kind: "range"; from: ISODate; to: ISODate; projectId?: string }
  /** Every open task (filters narrow it client-side). */
  | { kind: "all" };

export interface Habit {
  id: string;
  name: string;
  color: ProjectColor;
  targetPerWeek: number;
  sortKey: string;
  createdOn: string;
  checks: string[];
}

export interface DayNote {
  date: string;
  intention: string;
  reflection: string;
  capacityMinutes: number | null;
  plannedAt: string | null;
  reviewedAt: string | null;
  load: { tasks: number; estimatedMinutes: number; unestimated: number };
  completed: { id: string; title: string; completedAt: string }[];
}

export interface Stats {
  from: string;
  to: string;
  today: string;
  completedByDay: Record<string, number>;
  focusMinutesByDay: Record<string, number>;
  byHour: number[];
  byProject: { projectId: string | null; name: string; color: string; n: number }[];
  onTime: { onTime: number; late: number; undated: number };
  previous: { completed: number; focusMinutes: number };
  created: number;
  activeDays: string[];
}

export interface SavedFilter {
  id: string;
  name: string;
  query: string;
  sortKey: string;
}

export interface SearchHit {
  id: string;
  title: string;
  parentId: string | null;
  projectId: string | null;
  dueDate: ISODate | null;
  completed: boolean;
  /** Where the match was: the title or the notes. */
  field: "title" | "notes";
  snippet: string | null;
}
