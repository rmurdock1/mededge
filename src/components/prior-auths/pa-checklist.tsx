"use client";

import { useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { toggleChecklistItem } from "@/lib/prior-auths/actions";
import type { DocumentationItem } from "@/lib/types";

interface PAChecklistProps {
  paId: string;
  items: DocumentationItem[];
  readonly?: boolean;
}

export function PAChecklist({ paId, items, readonly }: PAChecklistProps) {
  const [isPending, startTransition] = useTransition();

  const totalRequired = items.filter((i) => i.required).length;
  const completedRequired = items.filter(
    (i) => i.required && i.completed
  ).length;

  function handleToggle(index: number, checked: boolean) {
    startTransition(async () => {
      await toggleChecklistItem(paId, index, checked);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Documentation Checklist</p>
        <p className="text-xs text-muted-foreground">
          {completedRequired}/{totalRequired} required
        </p>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-brand-500 transition-all"
          style={{
            width: `${totalRequired > 0 ? (completedRequired / totalRequired) * 100 : 0}%`,
          }}
        />
      </div>

      <div className={`space-y-2 ${isPending ? "opacity-60" : ""}`}>
        {items.map((item, i) => (
          <label
            key={i}
            className="flex items-start gap-3 rounded-md p-2 transition-colors hover:bg-accent/50"
          >
            <Checkbox
              checked={item.completed ?? false}
              onCheckedChange={(checked) =>
                !readonly && handleToggle(i, checked as boolean)
              }
              disabled={readonly || isPending}
              className="mt-0.5"
            />
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm ${
                  item.completed
                    ? "text-muted-foreground line-through"
                    : "text-foreground"
                }`}
              >
                {item.item}
                {item.required && (
                  <span className="ml-1 text-xs text-destructive">*</span>
                )}
              </p>
              {item.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.description}
                </p>
              )}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
