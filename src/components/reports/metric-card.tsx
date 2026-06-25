import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { ComparisonBadge } from "@/components/reports/comparison-badge";
import type { Comparison } from "@/lib/reports/report-service";
import { cn } from "@/lib/ui";

type MetricCardProps = {
  label: string;
  value: string;
  detail?: ReactNode;
  comparison?: Comparison;
  tone?: "default" | "green" | "amber" | "red" | "blue";
  compact?: boolean;
};

export function MetricCard({
  label,
  value,
  detail,
  comparison,
  tone = "default",
  compact = false
}: MetricCardProps) {
  return (
    <Card className={cn("min-w-0 p-4", !compact && "2xl:p-5")}>
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-gray-400">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 break-words font-bold tracking-normal text-gray-950 dark:text-gray-50",
          compact ? "text-xl" : "text-2xl",
          valueTones[tone]
        )}
      >
        {value}
      </p>
      <div className="mt-3 flex min-h-5 flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-gray-400">
        {comparison ? <ComparisonBadge comparison={comparison} compact /> : null}
        {detail ? <span className="min-w-0 break-words">{detail}</span> : null}
      </div>
    </Card>
  );
}

const valueTones = {
  default: "",
  green: "text-emerald-700 dark:text-emerald-200",
  amber: "text-amber-700 dark:text-amber-200",
  red: "text-red-700 dark:text-red-200",
  blue: "text-brand-700 dark:text-brand-100"
};
