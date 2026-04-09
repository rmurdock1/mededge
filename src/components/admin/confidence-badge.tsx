interface ConfidenceBadgeProps {
  score: number;
}

export function confidenceTier(score: number): {
  label: string;
  className: string;
} {
  if (score >= 0.9) {
    return {
      label: "High",
      className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    };
  }
  if (score >= 0.8) {
    return {
      label: "Medium",
      className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    };
  }
  if (score >= 0.5) {
    return {
      label: "Low",
      className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    };
  }
  return {
    label: "Unverified",
    className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };
}

export function ConfidenceBadge({ score }: ConfidenceBadgeProps) {
  const tier = confidenceTier(score);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tier.className}`}
    >
      {tier.label} ({(score * 100).toFixed(0)}%)
    </span>
  );
}
