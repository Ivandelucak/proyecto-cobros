import type { HTMLAttributes } from "react";
import { cn } from "@/lib/ui";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "card-base rounded-lg shadow-[0_12px_32px_rgba(22,33,43,0.08),0_1px_2px_rgba(22,33,43,0.05)] ring-1 ring-white/60 transition-[background-color,border-color,box-shadow,transform] duration-200 dark:shadow-none dark:ring-white/[0.04]",
        className
      )}
      {...props}
    />
  );
}
