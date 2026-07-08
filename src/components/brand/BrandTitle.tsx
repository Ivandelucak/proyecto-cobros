import { cn } from "@/lib/ui";

type BrandTitleProps = {
  className?: string;
};

export function BrandTitle({ className }: BrandTitleProps) {
  return (
    <div
      className={cn(
        "select-none whitespace-nowrap text-center text-lg md:text-xl lg:text-2xl font-black uppercase tracking-[0.15em] leading-none font-orbitron",
        className
      )}
    >
      <div className="flex items-center justify-center gap-1.5 drop-shadow-[0_2px_10px_rgba(255,122,0,0.25)]">
        <span className="text-[#FF7A00] font-black">FOX</span>
        <span className="text-[#E5E7EB] dark:text-[#F3F7FA] font-bold">POINT</span>
      </div>
      <span className="mx-auto mt-2 block h-0.5 w-10 rounded-full bg-gradient-to-r from-[#FF7A00] to-[#E5E7EB] dark:to-[#F3F7FA] opacity-75 shadow-sm" />
    </div>
  );
}
