import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

const fieldBase = [
  "w-full rounded-md bg-raised text-ink ring-1 ring-control ring-inset placeholder:text-ink-3",
  "transition-shadow duration-(--dur-fast) ease-enter",
  "hover:ring-ink-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
  "aria-invalid:ring-2 aria-invalid:ring-danger disabled:opacity-50",
].join(" ");

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(fieldBase, "h-10 px-3 text-base sm:text-sm", className)} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(fieldBase, "min-h-24 resize-y px-3 py-2 text-base leading-6 sm:text-sm", className)}
        {...props}
      />
    );
  },
);

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => React.ReactNode;
  className?: string;
}

/** Label + control + one line of help or error. Errors say what to do, not just what's wrong. */
export function Field({ label, hint, error, children, className }: FieldProps) {
  const id = useId();
  const msgId = `${id}-msg`;
  const msg = error ?? hint;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children({ id, "aria-describedby": msg ? msgId : undefined, "aria-invalid": error ? true : undefined })}
      {msg && (
        <p id={msgId} className={cn("text-xs", error ? "text-danger" : "text-ink-3")}>
          {msg}
        </p>
      )}
    </div>
  );
}
