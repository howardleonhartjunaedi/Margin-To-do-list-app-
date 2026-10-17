import type { Counts, Project, Task, View } from "./types";
import type { CreateTaskInput, UpdateTaskInput } from "./validation";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  } catch {
    throw new ApiError("You’re offline. Your change wasn’t saved — try again when you’re back.", 0);
  }
  if (res.status === 401) {
    window.location.href = `/sign-in?reauth=1&next=${encodeURIComponent(location.pathname)}`;
    throw new ApiError("Your session ended. Sign in again to continue.", 401);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.error ?? "Something went wrong. Your change wasn’t saved.", res.status);
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
  }
}

export const api = {
  tasks: (v: View) => request<Task[]>(`/api/tasks?${viewParams(v)}`),
  task: (id: string) => request<{ task: Task; subtasks: Task[] }>(`/api/tasks/${id}`),
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
};
