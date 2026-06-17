import { cn } from "@/lib/ui";

type AppLogoProps = {
  compact?: boolean;
  className?: string;
};

export function AppLogo({ compact = false, className }: AppLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="grid h-10 w-10 place-items-center rounded-lg border border-brand-100 bg-brand-50 text-brand-700 shadow-sm dark:border-brand-900/70 dark:bg-brand-950 dark:text-brand-100">
        <svg
          viewBox="0 0 32 32"
          aria-hidden="true"
          className="h-6 w-6"
          fill="none"
        >
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
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-100">
            POS Universal
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Comercio ágil
          </p>
        </div>
      ) : null}
    </div>
  );
}
