import type { ISODate } from "./dates";

export type Priority = 1 | 2 | 3 | 4;

/** A task as the client sees it. */
export interface Task {
  id: string;
  projectId: string | null;
  parentId: string | null;
  title: string;
  notes: string;
  priority: Priority;
  dueDate: ISODate | null;
  dueTime: string | null; // "HH:MM"
  recurrence: string | null; // RRULE body
  sortKey: string;
  completedAt: string | null;
  createdAt: string;
  labels: string[];
  subtaskCount: number;
  subtaskDone: number;
}

export interface Project {
  id: string;
  name: string;
  color: ProjectColor;
  sortKey: string;
  openCount: number;
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
  kind: "reminder" | "digest";
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
}

export type View =
  | { kind: "inbox" }
  | { kind: "today"; today: ISODate }
  | { kind: "upcoming"; today: ISODate; to: ISODate }
  | { kind: "project"; id: string };
