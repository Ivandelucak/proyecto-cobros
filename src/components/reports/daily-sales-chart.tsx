import type { DailySalesItem } from "@/lib/reports/report-service";
import { formatARS } from "@/lib/money";

type DailySalesChartProps = {
  items: DailySalesItem[];
};

export function DailySalesChart({ items }: DailySalesChartProps) {
  const max = Math.max(...items.map((item) => item.total.toNumber()), 0);

  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500 dark:text-gray-400">Sin datos.</p>;
  }

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-h-56 min-w-[520px] items-end gap-2">
        {items.map((item) => {
          const value = item.total.toNumber();
          const height = max > 0 ? Math.max(8, (value / max) * 160) : 4;

          return (
            <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex h-40 w-full items-end rounded-md bg-slate-100 p-1 dark:bg-neutral-800/80">
                <div
                  className="w-full rounded-sm bg-brand-600 transition-[height] dark:bg-brand-500"
                  style={{ height }}
                  title={`${item.label}: ${formatARS(item.total)} (${item.count})`}
                />
              </div>
              <div className="w-full text-center">
                <p className="text-[11px] font-semibold text-gray-950 dark:text-gray-50">
                  {item.label}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-gray-400">
                  {item.count}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
