import { cn } from "@/lib/ui";

type AppLogoProps = {
  compact?: boolean;
  className?: string;
};

export function AppLogo({ compact = false, className }: AppLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-xl border border-brand-300/70 bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700 text-white shadow-[0_10px_28px_rgba(76, 127, 163,0.28)] ring-1 ring-white/20 transition-colors duration-200 dark:border-[#344457] dark:from-brand-400 dark:via-brand-500 dark:to-brand-800 dark:ring-brand-300/10">
        <span className="absolute left-0 top-0 h-full w-1 bg-signal-accent" />
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-signal-accent shadow-sm shadow-signal-accent/40" />
        <svg viewBox="0 0 32 32" aria-hidden="true" className="h-7 w-7" fill="none">
          <path
            d="M8 7.5A2.5 2.5 0 0 1 10.5 5h11A2.5 2.5 0 0 1 24 7.5v14.2A2.3 2.3 0 0 1 22.6 24L16 27l-6.6-3A2.3 2.3 0 0 1 8 21.7V7.5Z"
            className="stroke-current"
            strokeWidth="2.2"
          />
          <path
            d="M12 10h8M12 14h3M18 14h2M12 19h2M16 19h2M20 19h.5"
            className="stroke-current"
            strokeLinecap="round"
            strokeWidth="2.2"
          />
          <path
            d="M11.5 23.5h9"
            className="stroke-current opacity-70"
            strokeLinecap="round"
            strokeWidth="1.6"
          />
        </svg>
      </div>
      {!compact ? (
        <div className="min-w-0">
          <p className="truncate text-sm font-black uppercase tracking-[0.12em] text-slate-950 dark:text-white">
            POS Universal
          </p>
          <p className="truncate text-xs font-semibold text-brand-700 dark:text-brand-300">
            Comercio agil
          </p>
        </div>
      ) : null}
    </div>
  );
}
