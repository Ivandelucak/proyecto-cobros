import type { HTMLAttributes } from "react";
import { cn } from "@/lib/ui";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-300 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.03),0_1px_2px_rgba(15,23,42,0.04)] transition-colors duration-200 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none",
        className
      )}
      {...props}
    />
  );
}
