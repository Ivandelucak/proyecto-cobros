import type { HTMLAttributes } from "react";
import { cn } from "@/lib/ui";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05),0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-white/70 transition-[background-color,border-color,box-shadow,transform] duration-200 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none dark:ring-white/[0.03]",
        className
      )}
      {...props}
    />
  );
}
