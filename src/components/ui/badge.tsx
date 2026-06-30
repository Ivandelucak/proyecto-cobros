import type { HTMLAttributes } from "react";
import { cn } from "@/lib/ui";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "green" | "red" | "amber" | "gray" | "blue" | "info" | "neutral";
};

const tones = {
  green: "badge-success",
  red: "badge-danger",
  amber: "badge-warning",
  gray: "badge-neutral",
  blue: "badge-info",
  info: "badge-info",
  neutral: "badge-neutral"
};

export function Badge({ className, tone = "gray", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-xs font-semibold leading-5 shadow-sm transition-colors duration-150",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
