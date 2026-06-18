import type { HTMLAttributes } from "react";
import { cn } from "@/lib/ui";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-gray-300/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_24px_rgba(15,23,42,0.04)] transition-colors duration-200 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none",
        className
      )}
      {...props}
    />
  );
}
