"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Kbd } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { spring } from "@/design/motion";
import { api, ApiError } from "@/lib/api";
import { getCurrentUserId } from "@/lib/data";
import { timeAgo } from "@/lib/dates";
import { modKey } from "@/lib/shortcuts";
import type { Comment, Role } from "@/lib/types";
import { Avatar } from "./share-dialog";

const fail = (e: unknown) => toast(e instanceof ApiError ? e.message : "Something went wrong. Try again.");

/** Plain text with links made clickable. No HTML from users ever reaches the DOM. */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow" className="text-accent underline decoration-1 underline-offset-2 break-all">
            {p}
          </a>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

export function Comments({ taskId, role }: { taskId: string; role: Role }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["comments", taskId], queryFn: () => api.comments(taskId) });
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const canComment = role !== "viewer";
  const me = getCurrentUserId();

  const post = async () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    try {
      const c = await api.addComment(taskId, body);
      qc.setQueryData<Comment[]>(["comments", taskId], (cs) => [...(cs ?? []), c]);
    } catch (e) {
      setText(body);
      fail(e);
    }
  };

  return (
    <section className="mt-8" aria-labelledby="comments-h">
      <div className="flex items-baseline justify-between border-b border-line pb-2">
        <h3 id="comments-h" className="font-mono text-2xs tracking-wider text-ink-3 uppercase">
          Comments
        </h3>
        {!!q.data?.length && <span className="font-mono text-2xs text-ink-3">{q.data.length}</span>}
      </div>
      <ul className="flex flex-col">
        <AnimatePresence initial={false}>
          {(q.data ?? []).map((c) => (
            <motion.li
              key={c.id}
              layout="position"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={spring.pop}
              className="group flex gap-3 border-b border-line py-3"
            >
              <Avatar name={c.authorName} />
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-2 text-xs">
                  <span className="font-medium text-ink">{c.authorName}</span>
                  <span className="font-mono text-2xs text-ink-3">
                    {timeAgo(c.createdAt)}
                    {c.editedAt && " · edited"}
                  </span>
                </p>
                {editing === c.id ? (
                  <EditBox
                    initial={c.body}
                    onCancel={() => setEditing(null)}
                    onSave={async (body) => {
                      setEditing(null);
                      qc.setQueryData<Comment[]>(["comments", taskId], (cs) => cs?.map((x) => (x.id === c.id ? { ...x, body, editedAt: new Date().toISOString() } : x)));
                      await api.editComment(c.id, body).catch((e) => (fail(e), qc.invalidateQueries({ queryKey: ["comments", taskId] })));
                    }}
                  />
                ) : (
                  <p className="mt-1 text-sm whitespace-pre-wrap text-ink-2">
                    <Linkified text={c.body} />
                  </p>
                )}
              </div>
              {(c.userId === me || role === "owner") && editing !== c.id && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Comment actions" className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
                      <Icon icon={MoreHorizontal} size="xs" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {c.userId === me && (
                      <DropdownMenuItem icon={<Icon icon={Pencil} />} onSelect={() => setEditing(c.id)}>
                        Edit
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      tone="danger"
                      icon={<Icon icon={Trash2} />}
                      onSelect={async () => {
                        qc.setQueryData<Comment[]>(["comments", taskId], (cs) => cs?.filter((x) => x.id !== c.id));
                        await api.deleteComment(c.id).catch((e) => (fail(e), qc.invalidateQueries({ queryKey: ["comments", taskId] })));
                      }}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {canComment ? (
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void post();
          }}
        >
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={q.data?.length ? "Reply…" : "Add a comment — a note to yourself, or to the people sharing this project"}
            aria-label="Add a comment"
            className="min-h-16"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void post();
              }
            }}
          />
          <div className="mt-2 flex items-center justify-end gap-2 text-xs text-ink-3">
            <span className="inline-flex items-center gap-1">
              <Kbd>{modKey()}</Kbd>
              <Kbd>↵</Kbd>
            </span>
            <Button type="submit" size="sm" disabled={!text.trim()}>
              Comment
            </Button>
          </div>
        </form>
      ) : (
        <p className="py-3 text-xs text-ink-3">You can read this project but not comment.</p>
      )}
    </section>
  );
}

function EditBox({ initial, onSave, onCancel }: { initial: string; onSave: (b: string) => void; onCancel: () => void }) {
  const [v, setV] = useState(initial);
  return (
    <form
      className="mt-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) onSave(v.trim());
      }}
    >
      <Textarea value={v} onChange={(e) => setV(e.target.value)} autoFocus aria-label="Edit comment" className="min-h-16" />
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!v.trim()}>
          Save
        </Button>
      </div>
    </form>
  );
}
