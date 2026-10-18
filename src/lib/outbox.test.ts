import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
let offline = false;
const rejected = new Set<string>();

vi.mock("./api", () => {
  class ApiError extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message);
    }
  }
  const send = async (label: string, id: string) => {
    if (offline) throw new ApiError("offline", 0);
    if (rejected.has(id)) throw new ApiError("gone", 404);
    calls.push(label);
    return {};
  };
  return {
    ApiError,
    api: {
      createTask: (input: { id: string; title: string }) => send(`create ${input.id} ${input.title}`, input.id),
      updateTask: (id: string, patch: object) => send(`update ${id} ${JSON.stringify(patch)}`, id),
    },
  };
});

const { clearOutbox, enqueue, flushOutbox, pendingOps } = await import("./outbox");

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";

beforeEach(() => {
  clearOutbox();
  calls.length = 0;
  offline = false;
  rejected.clear();
});

describe("offline outbox", () => {
  it("collapses successive edits to the same task", () => {
    enqueue({ kind: "updateTask", id: A, patch: { title: "One" } });
    enqueue({ kind: "updateTask", id: A, patch: { priority: 1 } });
    enqueue({ kind: "updateTask", id: B, patch: { completed: true } });
    enqueue({ kind: "updateTask", id: A, patch: { title: "Two" } });
    expect(pendingOps()).toEqual([
      { kind: "updateTask", id: A, patch: { title: "One", priority: 1 } },
      { kind: "updateTask", id: B, patch: { completed: true } },
      { kind: "updateTask", id: A, patch: { title: "Two" } },
    ]);
  });

  it("replays in order: a task created offline, then edited offline", async () => {
    enqueue({ kind: "createTask", id: A, input: { id: A, title: "Call the plumber" } });
    enqueue({ kind: "updateTask", id: A, patch: { completed: true } });
    expect(await flushOutbox()).toEqual({ sent: 2, failed: 0 });
    expect(calls).toEqual([`create ${A} Call the plumber`, `update ${A} {"completed":true}`]);
    expect(pendingOps()).toEqual([]);
  });

  it("stops and keeps everything while still offline", async () => {
    enqueue({ kind: "updateTask", id: A, patch: { completed: true } });
    offline = true;
    expect(await flushOutbox()).toEqual({ sent: 0, failed: 0 });
    expect(pendingOps()).toHaveLength(1);
  });

  it("drops a change the server rejects, without blocking the rest", async () => {
    rejected.add(A);
    enqueue({ kind: "updateTask", id: A, patch: { completed: true } });
    enqueue({ kind: "updateTask", id: B, patch: { completed: true } });
    expect(await flushOutbox()).toEqual({ sent: 1, failed: 1 });
    expect(calls).toEqual([`update ${B} {"completed":true}`]);
    expect(pendingOps()).toEqual([]);
  });
});
