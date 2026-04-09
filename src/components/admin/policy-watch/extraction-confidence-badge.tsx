import type { ExtractionConfidence } from "@/lib/types";

const CONFIDENCE_STYLES: Record<
  ExtractionConfidence,
  { classes: string }
> = {
  high: {
    classes: "bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-900/20 dark:text-green-400",
  },
  medium: {
    classes: "bg-yellow-50 text-yellow-700 ring-yellow-600/20 dark:bg-yellow-900/20 dark:text-yellow-400",
  },
  low: {
    classes: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-900/20 dark:text-red-400",
  },
};

export function ExtractionConfidenceBadge({
  confidence,
}: {
  confidence: ExtractionConfidence | null;
}) {
  if (!confidence) return null;
  const style = CONFIDENCE_STYLES[confidence];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${style.classes}`}
    >
      {confidence}
    </span>
  );
}
