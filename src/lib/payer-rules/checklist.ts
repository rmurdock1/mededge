import type { DocumentationItem } from "@/lib/types";
import type { PALookupResult } from "./types";

/**
 * Generates a documentation checklist from PA lookup results.
 * Each item starts uncompleted. Staff check items off as they gather docs.
 *
 * Accepts the new discriminated-union `PALookupResult[]` from
 * `checkPARequired()`. Skips results where `pa_required !== true`.
 */
export function generateChecklist(
  results: PALookupResult[]
): DocumentationItem[] {
  const seen = new Set<string>();
  const checklist: DocumentationItem[] = [];

  for (const result of results) {
    if (result.pa_required !== true) continue;

    for (const item of result.documentation_requirements) {
      // Deduplicate by item name
      if (seen.has(item.item)) continue;
      seen.add(item.item);

      checklist.push({
        ...item,
        completed: false,
      });
    }
  }

  // Sort: required items first, then optional
  return checklist.sort((a, b) => {
    if (a.required === b.required) return 0;
    return a.required ? -1 : 1;
  });
}

/**
 * Returns whether a checklist is complete enough to submit.
 * All required items must be completed.
 */
export function isChecklistReady(checklist: DocumentationItem[]): boolean {
  return checklist
    .filter((item) => item.required)
    .every((item) => item.completed === true);
}

/**
 * Returns the completion percentage of a checklist.
 */
export function getChecklistProgress(checklist: DocumentationItem[]): {
  completed: number;
  total: number;
  requiredCompleted: number;
  requiredTotal: number;
  percentage: number;
} {
  const total = checklist.length;
  const completed = checklist.filter((i) => i.completed).length;
  const requiredItems = checklist.filter((i) => i.required);
  const requiredCompleted = requiredItems.filter((i) => i.completed).length;
  const requiredTotal = requiredItems.length;

  return {
    completed,
    total,
    requiredCompleted,
    requiredTotal,
    percentage: total === 0 ? 100 : Math.round((completed / total) * 100),
  };
}
