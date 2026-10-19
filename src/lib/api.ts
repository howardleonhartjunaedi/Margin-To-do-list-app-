import type { Comment, Counts, DayNote, Habit, Member, Notification, Project, ReminderInfo, Role, SavedFilter, SearchHit, Settings, Stats, Task, View } from "./types";

export interface MembersResponse {
  myRole: Role;
  members: Member[];
  invites: { id: string; email: string | null; role: Role; expiresAt: string; url: string }[];
}
export interface ApiTokenInfo {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}
export interface WebhookInfo {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  failureCount: number;
  lastStatus: number | null;
  lastDeliveryAt: string | null;
  createdAt: string;
}
export interface DeliveryInfo {
  id: string;
  event: string;
  status: string;
  attempts: number;
  responseStatus: number | null;
  error: string | null;
  createdAt: string;
  deliveredAt: string | null;
}
export interface ImportSummary {
  tasks: number;
  subtasks: number;
  completed: number;
  newProjects: string[];
  sample: string[];
  imported: boolean;
}
import type { CreateTaskInput, UpdateTaskInput } from "./validation";
import { m } from "@/i18n/catalogs";
import { currentLocale } from "@/i18n/runtime";
import { DEMO, demoFetch } from "./demo";

export interface TriageSuggestion {
  taskId: string;
  title: string;
  projectId: string | null;
  projectName: string | null;
  dueDate: string | null;
  priority: 1 | 2 | 3 | 4;
  reason: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Identifies this tab, so real-time echoes of its own changes can be ignored. */
export const clientId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random());

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    const req = { ...init, headers: { "content-type": "application/json", "x-client-id": clientId, ...init?.headers } };
    res = DEMO ? await demoFetch(path, req) : await fetch(path, req);
  } catch {
    throw new ApiError(m().common.offlineNotSaved, 0);
  }
  if (res.status === 401) {
    window.location.href = `/session-ended?next=${encodeURIComponent(location.pathname)}`;
    throw new ApiError(m().common.sessionEnded, 401);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.error ?? m().common.somethingWrong, res.status);
  return data as T;
}

export function viewParams(v: View): string {
  switch (v.kind) {
    case "inbox":
      return "view=inbox";
    case "today":
      return `view=today&today=${v.today}`;
    case "upcoming":
      return `view=upcoming&today=${v.today}&to=${v.to}`;
    case "project":
      return `view=project&id=${encodeURIComponent(v.id)}`;
    case "range":
      return `view=range&from=${v.from}&to=${v.to}${v.projectId ? `&projectId=${encodeURIComponent(v.projectId)}` : ""}`;
    case "all":
      return "view=all";
  }
}

export const api = {
  tasks: (v: View) => request<Task[]>(`/api/tasks?${viewParams(v)}`),
  task: (id: string) =>
    request<{ task: Task; subtasks: Task[]; reminders: ReminderInfo[]; focus: { minutes: number; sessions: number }; role: Role }>(`/api/tasks/${id}`),
  createTask: (input: CreateTaskInput) => request<Task>("/api/tasks", { method: "POST", body: JSON.stringify(input) }),
  updateTask: (id: string, patch: UpdateTaskInput) =>
    request<Task>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  projects: () => request<Project[]>("/api/projects"),
  createProject: (input: { id?: string; name: string; color?: string }) =>
    request<Project>("/api/projects", { method: "POST", body: JSON.stringify(input) }),
  updateProject: (id: string, patch: { name?: string; color?: string; sortKey?: string; archived?: boolean }) =>
    request<Project>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteProject: (id: string) => request<{ ok: true }>(`/api/projects/${id}`, { method: "DELETE" }),
  counts: (today: string) => request<Counts>(`/api/counts?today=${today}`),

  addReminder: (taskId: string, spec: { offsetMinutes: number } | { at: string }) =>
    request<ReminderInfo[]>(`/api/tasks/${taskId}/reminders`, { method: "POST", body: JSON.stringify(spec) }),
  deleteReminder: (id: string) => request<{ ok: true }>(`/api/reminders/${id}`, { method: "DELETE" }),
  snooze: (id: string, choice: { minutes: number } | { tomorrowAt: string }) =>
    request<{ fireAt: string }>(`/api/reminders/${id}/snooze`, { method: "POST", body: JSON.stringify(choice) }),

  notifications: () => request<{ items: Notification[]; unread: number }>("/api/notifications"),
  markRead: (ids: string[] | "all") =>
    request<{ items: Notification[]; unread: number }>("/api/notifications", {
      method: "POST",
      body: JSON.stringify(ids === "all" ? { all: true } : { ids }),
    }),

  settings: () => request<Settings & { pushDevices: number; aiAvailable: boolean }>("/api/settings"),
  updateSettings: (patch: Partial<Settings>) =>
    request<Settings & { pushDevices: number; aiAvailable: boolean }>("/api/settings", { method: "PATCH", body: JSON.stringify(patch) }),

  pushKey: () => request<{ publicKey: string | null }>("/api/push"),
  subscribePush: (sub: PushSubscriptionJSON) => request<{ ok: true }>("/api/push", { method: "POST", body: JSON.stringify(sub) }),
  unsubscribePush: (endpoint: string) => request<{ ok: true }>("/api/push", { method: "DELETE", body: JSON.stringify({ endpoint }) }),
  testPush: () => request<{ ok: true }>("/api/push/test", { method: "POST" }),

  search: (q: string, signal?: AbortSignal) => request<SearchHit[]>(`/api/search?q=${encodeURIComponent(q)}`, { signal }),
  filters: () => request<SavedFilter[]>("/api/filters"),
  createFilter: (input: { id: string; name: string; query: string }) =>
    request<SavedFilter>("/api/filters", { method: "POST", body: JSON.stringify(input) }),
  updateFilter: (id: string, patch: { name?: string; query?: string }) =>
    request<SavedFilter>(`/api/filters/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteFilter: (id: string) => request<{ ok: true }>(`/api/filters/${id}`, { method: "DELETE" }),

  recordFocus: (s: {
    taskId: string | null;
    kind: "focus" | "break";
    plannedSeconds: number;
    actualSeconds: number;
    completed: boolean;
    startedAt: string;
    endedAt: string;
  }) => request<{ id: string }>("/api/focus", { method: "POST", body: JSON.stringify(s), keepalive: true }),
  habits: () => request<Habit[]>("/api/habits"),
  createHabit: (h: { id: string; name: string; color?: string; targetPerWeek?: number }) =>
    request<Habit[]>("/api/habits", { method: "POST", body: JSON.stringify(h) }),
  updateHabit: (id: string, patch: { name?: string; color?: string; targetPerWeek?: number; archived?: boolean }) =>
    request<Habit[]>(`/api/habits/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteHabit: (id: string) => request<{ ok: true }>(`/api/habits/${id}`, { method: "DELETE" }),
  setHabitCheck: (id: string, date: string, done: boolean) =>
    request<{ ok: true }>(`/api/habits/${id}/checks`, { method: "PUT", body: JSON.stringify({ date, done }) }),
  day: (date: string) => request<DayNote>(`/api/days/${date}`),
  saveDay: (date: string, patch: Partial<Pick<DayNote, "intention" | "reflection" | "capacityMinutes">> & { planned?: boolean; reviewed?: boolean }) =>
    request<DayNote>(`/api/days/${date}`, { method: "PUT", body: JSON.stringify(patch) }),
  stats: (from: string, to: string) => request<Stats>(`/api/stats?from=${from}&to=${to}`),

  members: (projectId: string) => request<MembersResponse>(`/api/projects/${projectId}/members`),
  invite: (projectId: string, input: { email?: string | null; role: Role }) =>
    request<{ id: string; url: string; email: string | null; role: Role }>(`/api/projects/${projectId}/invites`, { method: "POST", body: JSON.stringify(input) }),
  revokeInvite: (id: string) => request<{ ok: true }>(`/api/invites/${id}`, { method: "DELETE" }),
  acceptInvite: (token: string) => request<{ projectId: string }>(`/api/invites/${token}/accept`, { method: "POST" }),
  setRole: (projectId: string, userId: string, role: Role) =>
    request<MembersResponse>(`/api/projects/${projectId}/members/${userId}`, { method: "PATCH", body: JSON.stringify({ role }) }),
  removeMember: (projectId: string, userId: string) => request<{ ok: true }>(`/api/projects/${projectId}/members/${userId}`, { method: "DELETE" }),

  comments: (taskId: string) => request<Comment[]>(`/api/tasks/${taskId}/comments`),
  addComment: (taskId: string, body: string) => request<Comment>(`/api/tasks/${taskId}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
  editComment: (id: string, body: string) => request<{ ok: true }>(`/api/comments/${id}`, { method: "PATCH", body: JSON.stringify({ body }) }),
  deleteComment: (id: string) => request<{ ok: true }>(`/api/comments/${id}`, { method: "DELETE" }),

  feed: () => request<{ enabled: boolean; url: string | null }>("/api/ical"),
  rotateFeed: () => request<{ enabled: boolean; url: string | null }>("/api/ical", { method: "POST" }),
  disableFeed: () => request<{ enabled: boolean; url: string | null }>("/api/ical", { method: "DELETE" }),
  aiBreakdown: (taskId: string) =>
    request<{ steps: { title: string; estimateMinutes: number | null }[] }>("/api/ai/breakdown", {
      method: "POST",
      body: JSON.stringify({ taskId, locale: currentLocale() }),
    }),
  aiTriage: () => request<{ suggestions: TriageSuggestion[] }>("/api/ai/triage", { method: "POST", body: JSON.stringify({ locale: currentLocale() }) }),
  importData: (input: { format: "json" | "csv" | "text"; content: string; dryRun?: boolean }) =>
    request<ImportSummary>("/api/import", { method: "POST", body: JSON.stringify(input) }),
  tokens: () => request<ApiTokenInfo[]>("/api/tokens"),
  createToken: (name: string) => request<ApiTokenInfo & { token: string }>("/api/tokens", { method: "POST", body: JSON.stringify({ name }) }),
  revokeToken: (id: string) => request<{ ok: true }>(`/api/tokens/${id}`, { method: "DELETE" }),
  webhooks: () => request<WebhookInfo[]>("/api/webhooks"),
  createWebhook: (input: { url: string; events: string[] }) =>
    request<WebhookInfo & { secret: string }>("/api/webhooks", { method: "POST", body: JSON.stringify(input) }),
  updateWebhook: (id: string, patch: { events?: string[]; active?: boolean }) =>
    request<WebhookInfo>(`/api/webhooks/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteWebhook: (id: string) => request<{ ok: true }>(`/api/webhooks/${id}`, { method: "DELETE" }),
  testWebhook: (id: string) => request<{ ok: true }>(`/api/webhooks/${id}/test`, { method: "POST" }),
  deliveries: (id: string) => request<DeliveryInfo[]>(`/api/webhooks/${id}/deliveries`),
};
