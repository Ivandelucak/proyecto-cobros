import type { ReactNode } from "react";

export type MobileIconName =
  | "home"
  | "sales"
  | "quote"
  | "box"
  | "stock"
  | "tag"
  | "cart"
  | "chart"
  | "more"
  | "desktop"
  | "cash"
  | "plus";

export function MobileIcon({ name, className = "h-5 w-5" }: { name: MobileIconName; className?: string }) {
  const paths: Record<MobileIconName, ReactNode> = {
    home: <path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9Z" />,
    sales: <path d="M7 4h10a2 2 0 0 1 2 2v14H5V6a2 2 0 0 1 2-2Zm2 5h6m-6 4h6m-6 4h3" />,
    quote: <path d="M7 3v4m10-4v4M5 9h14M6 5h12a2 2 0 0 1 2 2v12H4V7a2 2 0 0 1 2-2Z" />,
    box: <path d="m4 8 8-4 8 4v8l-8 4-8-4V8Zm0 0 8 4 8-4m-8 4v8" />,
    stock: <path d="M5 20v-7m7 7V4m7 16v-11M3 20h18" />,
    tag: <path d="M4 5h8l8 8-7 7-8-8V5Zm5 4h.01" />,
    cart: <path d="M4 5h2l2 10h9l2-7H7m2 11h.01m8 0h.01" />,
    chart: <path d="M4 20h16M7 17v-5m5 5V6m5 11v-8" />,
    more: <path d="M5 12h.01M12 12h.01M19 12h.01" />,
    desktop: <path d="M4 5h16v10H4V5Zm4 15h8m-4-5v5" />,
    cash: <path d="M4 8h16v8H4zM8 12h.01M16 12h.01M12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />,
    plus: <path d="M12 5v14m-7-7h14" />
  };

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9">
        {paths[name]}
      </g>
    </svg>
  );
}
