import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/ui";

type ReportSectionProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function ReportSection({
  title,
  description,
  action,
  children,
  className,
  bodyClassName
}: ReportSectionProps) {
  return (
    <Card className={cn("min-w-0 overflow-hidden", className)}>
      <div className="flex min-w-0 flex-col gap-3 border-b border-slate-200 px-4 py-4 dark:border-neutral-800 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-gray-950 dark:text-gray-50">{title}</h2>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-gray-400">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </Card>
  );
}
