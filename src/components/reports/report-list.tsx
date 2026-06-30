import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/ui";

export type ReportListItem = {
  id: string;
  title: string;
  description?: string;
  value?: string;
  badge?: string;
  badgeTone?: "green" | "red" | "amber" | "gray" | "blue" | "info" | "neutral";
  action?: ReactNode;
};

type ReportListProps = {
  items: ReportListItem[];
  emptyText: string;
  dense?: boolean;
};

export function ReportList({ items, emptyText, dense = false }: ReportListProps) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500 dark:text-[#7F8D9A]">{emptyText}</p>;
  }

  return (
    <div className="divide-y divide-slate-100 dark:divide-neutral-800">
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "flex min-w-0 flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between",
            dense && "py-2.5"
          )}
        >
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="min-w-0 break-words text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
                {item.title}
              </p>
              {item.badge ? <Badge tone={item.badgeTone}>{item.badge}</Badge> : null}
            </div>
            {item.description ? (
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-[#7F8D9A]">
                {item.description}
              </p>
            ) : null}
          </div>
          {(item.value || item.action) ? (
            <div className="flex shrink-0 items-center gap-2 sm:justify-end">
              {item.value ? (
                <p className="text-sm font-bold text-gray-950 dark:text-[#F3F7FA]">
                  {item.value}
                </p>
              ) : null}
              {item.action}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
