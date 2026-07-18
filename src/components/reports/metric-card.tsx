import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/ui";

type MetricCardProps = {
  label: string;
  value: string;
  detail?: ReactNode;
  tone?: "default" | "green" | "amber" | "red" | "blue";
  compact?: boolean;
};

export function MetricCard({
  label,
  value,
  detail,
  tone = "default",
  compact = false
}: MetricCardProps) {
  return (
    <Card className={cn("pos-accent-line min-w-0 p-4 pl-5", !compact && "2xl:p-5 2xl:pl-6")}>
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-[#7F8D9A]">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 break-words font-black tracking-tight text-gray-950 dark:text-[#F3F7FA]",
          compact ? "text-xl" : "text-2xl",
          valueTones[tone]
        )}
      >
        {value}
      </p>
      {detail ? (
        <div className="mt-3 text-xs text-slate-500 dark:text-[#7F8D9A]">
          <span className="min-w-0 break-words">{detail}</span>
        </div>
      ) : null}
    </Card>
  );
}

const valueTones = {
  default: "",
  green: "text-[#1F8F63] dark:text-[#D4F2E1]",
  amber: "text-[#C98A26] dark:text-[#FFE4A6]",
  red: "text-[#C94E4E] dark:text-[#FFD9D9]",
  blue: "text-brand-700 dark:text-brand-100"
};
