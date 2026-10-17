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

export type View =
  | { kind: "inbox" }
  | { kind: "today"; today: ISODate }
  | { kind: "upcoming"; today: ISODate; to: ISODate }
  | { kind: "project"; id: string };
