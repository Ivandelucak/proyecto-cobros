import { cn } from "@/lib/ui";

type AppLogoProps = {
  compact?: boolean;
  className?: string;
};

export function AppLogo({ compact = false, className }: AppLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative grid h-10 w-10 place-items-center rounded-lg border border-brand-100 bg-white text-brand-700 shadow-sm ring-1 ring-brand-50 transition-colors duration-200 dark:border-brand-500/30 dark:bg-neutral-950 dark:text-brand-100 dark:ring-brand-500/10">
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/40" />
        <svg viewBox="0 0 32 32" aria-hidden="true" className="h-6 w-6" fill="none">
          <path
            d="M7 8.5A2.5 2.5 0 0 1 9.5 6h13A2.5 2.5 0 0 1 25 8.5v15A2.5 2.5 0 0 1 22.5 26h-13A2.5 2.5 0 0 1 7 23.5v-15Z"
            className="stroke-current"
            strokeWidth="2"
          />
          <path
            d="M11 11h10M11 15h4M19 15h2M11 20h2M16 20h2M21 20h.5"
            className="stroke-current"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </svg>
      </div>
      {!compact ? (
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold uppercase tracking-wide text-slate-950 dark:text-white">
            POS Universal
          </p>
          <p className="truncate text-xs font-medium text-slate-500 dark:text-gray-400">
            Comercio agil
          </p>
        </div>
      ) : null}
    </div>
  );
}
