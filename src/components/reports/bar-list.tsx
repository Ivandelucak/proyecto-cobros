import { cn } from "@/lib/ui";

export type BarListItem = {
  label: string;
  value: number;
  valueLabel: string;
  detail?: string;
  percentLabel?: string;
  tone?: "blue" | "green" | "amber" | "red" | "gray";
};

type BarListProps = {
  items: BarListItem[];
  emptyText: string;
  maxValue?: number;
};

export function BarList({ items, emptyText, maxValue }: BarListProps) {
  const visibleItems = items.filter((item) => item.value > 0 || item.valueLabel !== "");
  const max = maxValue ?? Math.max(...items.map((item) => item.value), 0);

  if (visibleItems.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500 dark:text-gray-400">{emptyText}</p>;
  }

  return (
    <div className="space-y-3">
      {visibleItems.map((item) => {
        const width = max > 0 ? Math.min(100, Math.max(4, (item.value / max) * 100)) : 0;

        return (
          <div key={item.label} className="min-w-0">
            <div className="flex min-w-0 items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-950 dark:text-gray-50">
                  {item.label}
                </p>
                {item.detail ? (
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-gray-400">
                    {item.detail}
                  </p>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold text-gray-950 dark:text-gray-50">
                  {item.valueLabel}
                </p>
                {item.percentLabel ? (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-400">
                    {item.percentLabel}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-neutral-800">
              <div
                className={cn("h-full rounded-full", barTones[item.tone ?? "blue"])}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const barTones = {
  blue: "bg-brand-600 dark:bg-brand-500",
  green: "bg-emerald-600 dark:bg-emerald-500",
  amber: "bg-amber-500 dark:bg-amber-400",
  red: "bg-red-600 dark:bg-red-500",
  gray: "bg-slate-500 dark:bg-neutral-500"
};
