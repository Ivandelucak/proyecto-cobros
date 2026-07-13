import Link from "next/link";
import { cn } from "@/lib/ui";
import { MobileIcon, type MobileIconName } from "./MobileIcon";

export function MobileQuickAccessCard({
  href,
  label,
  icon,
  className
}: {
  href: string;
  label: string;
  icon: MobileIconName;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-[68px] items-center gap-3 rounded-xl border border-[#273342] bg-[#121922] px-3.5 text-left shadow-sm transition-[background-color,border-color,box-shadow] active:bg-[#1D3140] active:shadow-inner",
        "hover:border-[#4C7FA3]/60 hover:bg-[#162330] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C7FA3] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1015]",
        className
      )}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#344657] bg-[#1D3140] text-[#8CA3B7]">
        <MobileIcon name={icon} className="h-6 w-6" />
      </span>
      <span className="min-w-0 text-sm font-bold text-[#F3F7FA]">{label}</span>
    </Link>
  );
}
