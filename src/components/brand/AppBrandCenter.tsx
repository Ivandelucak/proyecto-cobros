import { cn } from "@/lib/ui";
import { APP_NAME } from "@/lib/branding";

type AppBrandCenterProps = {
  className?: string;
};

export function AppBrandCenter({ className }: AppBrandCenterProps) {
  return (
    <div
      className={cn(
        "pointer-events-none select-none whitespace-nowrap text-center text-[clamp(1rem,1.25vw,1.375rem)] font-bold tracking-[0.05em]",
        className
      )}
      aria-label={APP_NAME}
    >
      <div className="[text-shadow:0_1px_12px_rgba(76,127,163,0.20)]">
        <span className="text-[var(--text-primary)]">Fox</span>{" "}
        <span className="text-[var(--primary)]">Point</span>
      </div>
      <span className="mx-auto mt-1 block h-0.5 w-8 rounded-full bg-[var(--primary)] opacity-45" />
    </div>
  );
}
