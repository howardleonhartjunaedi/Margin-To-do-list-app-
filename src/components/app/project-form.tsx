"use client";

import * as RadioGroup from "@radix-ui/react-radio-group";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { PROJECT_COLORS } from "@/lib/project-colors";
import type { ProjectColor } from "@/lib/types";
import { useT } from "@/i18n/client";

export function ProjectForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: { name: string; color: ProjectColor };
  submitLabel: string;
  onSubmit: (v: { name: string; color: ProjectColor }) => void | Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState<ProjectColor>(initial?.color ?? "ink");
  const [error, setError] = useState<string>();
  const t = useT().projectForm;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return setError(t.needsName);
        void onSubmit({ name: name.trim(), color });
      }}
    >
      <Field label={t.name} error={error}>
        {(p) => (
          <Input
            {...p}
            autoFocus
            value={name}
            maxLength={120}
            placeholder={t.placeholder}
            onChange={(e) => (setName(e.target.value), setError(undefined))}
          />
        )}
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">{t.color}</legend>
        <RadioGroup.Root
          value={color}
          onValueChange={(v) => setColor(v as ProjectColor)}
          className="flex flex-wrap gap-1.5"
          orientation="horizontal"
        >
          {PROJECT_COLORS.map((c) => (
            <RadioGroup.Item
              key={c.value}
              value={c.value}
              aria-label={t.colors[c.value]}
              title={t.colors[c.value]}
              className={cn(
                "grid size-8 place-items-center rounded-md ring-1 ring-line ring-inset transition-shadow duration-(--dur-fast)",
                "hover:ring-line-strong data-[state=checked]:ring-2 data-[state=checked]:ring-ink",
              )}
            >
              <span className={cn("size-3 rounded-full", c.dot)} />
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>
      </fieldset>
      <Button type="submit" variant="primary" className="self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
