import type { Comparison } from "@/lib/reports/report-service";
import { cn } from "@/lib/ui";

type ComparisonBadgeProps = {
  comparison: Comparison;
  compact?: boolean;
};

export function ComparisonBadge({ comparison, compact = false }: ComparisonBadgeProps) {
  const tone = getTone(comparison.tone);

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-xs font-semibold leading-5",
        tones[tone],
        compact && "px-1.5 text-[11px]"
      )}
      title={formatComparison(comparison)}
    >
      {formatComparison(comparison)}
    </span>
  );
}

const tones = {
  positive:
    "border-[#BFE3D2] bg-[#E8F6EF] text-[#1F8F63] dark:border-[#28A36A]/55 dark:bg-[#28A36A]/14 dark:text-[#D4F2E1]",
  negative:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200",
  neutral:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-[#344457] dark:bg-[#273342] dark:text-[#A9B6C2]"
};

function getTone(tone: Comparison["tone"]) {
  return tone;
}

function formatComparison(comparison: Comparison) {
  if (comparison.state === "no-data" || comparison.state === "no-change") {
    return "Sin variacion";
  }

  if (comparison.state === "no-activity") {
    return "Sin actividad en este periodo";
  }

  if (comparison.state === "new-activity") {
    return "Nueva actividad";
  }

  if (comparison.percent === null) {
    return "Sin variacion";
  }

  const arrow = comparison.direction === "up" ? "↑" : "↓";
  return `${arrow} ${formatPercent(Math.abs(comparison.percent))} vs. periodo anterior`;
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value) + "%";
}
