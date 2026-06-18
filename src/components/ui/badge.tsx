import type { HTMLAttributes } from "react";
import { cn } from "@/lib/ui";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "green" | "red" | "amber" | "gray" | "blue";
};

const tones = {
  green:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200",
  red:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200",
  amber:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200",
  gray:
    "border-gray-200 bg-gray-50 text-gray-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-200",
  blue:
    "border-brand-100 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-100"
};

export function Badge({ className, tone = "gray", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
