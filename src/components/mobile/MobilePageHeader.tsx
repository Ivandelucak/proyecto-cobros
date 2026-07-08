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
    <div className="flex items-center justify-between gap-3 pb-2 border-b border-[#273342]/60">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Volver"
          className="flex items-center justify-center min-w-[40px] min-h-[40px] rounded-lg bg-[#121922] border border-[#273342] text-[#A9B6C2] active:text-[#F3F7FA] active:bg-[#1D3140]/30 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-[#F3F7FA] truncate">{title}</h2>
          {subtitle && <p className="text-[11px] text-[#A9B6C2] truncate">{subtitle}</p>}
        </div>
      </div>
      {rightAction && <div className="shrink-0">{rightAction}</div>}
    </div>
  );
}
