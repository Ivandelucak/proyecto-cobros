import type { Comparison } from "@/lib/reports/report-service";
import { cn } from "@/lib/ui";

type ComparisonBadgeProps = {
  comparison: Comparison;
  compact?: boolean;
};

export function ComparisonBadge({ comparison, compact = false }: ComparisonBadgeProps) {
  const tone = getTone(comparison.direction);

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-xs font-semibold leading-5",
        tones[tone],
        compact && "px-1.5 text-[11px]"
      )}
    >
      {formatComparison(comparison)}
    </span>
  );
}

const tones = {
  green:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200",
  red:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200",
  gray:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-200"
};

function getTone(direction: Comparison["direction"]) {
  if (direction === "up") {
    return "green";
  }

  if (direction === "down") {
    return "red";
  }

  return "gray";
}

function formatComparison(comparison: Comparison) {
  if (comparison.direction === "none" || comparison.percent === null) {
    return "Sin base previa";
  }

  if (comparison.direction === "flat") {
    return "Sin cambio";
  }

  const sign = comparison.direction === "up" ? "+" : "";
  return `${sign}${formatPercent(comparison.percent)}`;
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value) + "%";
}
