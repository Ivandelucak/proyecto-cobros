"use client";

import { useRouter } from "next/navigation";

type MobilePageHeaderProps = {
  title: string;
  subtitle?: string;
  fallbackUrl?: string;
  rightAction?: React.ReactNode;
};

export function MobilePageHeader({ title, subtitle, fallbackUrl = "/m", rightAction }: MobilePageHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    // If there is history (window.history.length > 1), go back, otherwise go to fallbackUrl
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackUrl);
    }
  };

  return (
    <div className="flex min-h-[56px] items-center justify-between gap-3 border-b border-[#273342]/75 pb-3">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Volver"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[#273342] bg-[#121922] text-[#A9B6C2] transition-colors active:bg-[#1D3140] active:text-[#F3F7FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C7FA3]"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-extrabold leading-tight text-[#F3F7FA]">{title}</h1>
          {subtitle && <p className="mt-0.5 truncate text-sm text-[#A9B6C2]">{subtitle}</p>}
        </div>
      </div>
      {rightAction && <div className="shrink-0">{rightAction}</div>}
    </div>
  );
}
