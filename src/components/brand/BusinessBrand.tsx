"use client";

import { useState } from "react";
import { APP_NAME, APP_TAGLINE } from "@/lib/branding";
import { cn } from "@/lib/ui";

type BusinessBrandProps = {
  logoUrl?: string | null;
  businessName?: string | null;
  subtitle?: string | null;
  collapsed?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: {
    frame: "h-9 w-9 rounded-lg",
    icon: "h-5 w-5",
    title: "text-xs",
    subtitle: "text-[11px]"
  },
  md: {
    frame: "h-11 w-11 rounded-xl",
    icon: "h-7 w-7",
    title: "text-sm",
    subtitle: "text-xs"
  },
  lg: {
    frame: "h-14 w-14 rounded-xl",
    icon: "h-8 w-8",
    title: "text-base",
    subtitle: "text-sm"
  }
};

export function BusinessBrand({
  logoUrl,
  businessName,
  subtitle,
  collapsed = false,
  size = "md",
  className
}: BusinessBrandProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const hasLogo = Boolean(logoUrl) && !imageFailed;
  const title = hasLogo ? businessName || "Mi comercio" : APP_NAME;
  const description = hasLogo ? subtitle || APP_TAGLINE : APP_TAGLINE;
  const classes = sizeClasses[size];

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <div
        className={cn(
          "relative grid shrink-0 place-items-center overflow-hidden border shadow-[0_10px_28px_rgba(76,127,163,0.14)] ring-1 ring-white/20 transition-colors duration-200 dark:ring-brand-300/10",
          hasLogo
            ? "border-[color:var(--panel-border-strong)] bg-[var(--panel-bg-elevated)] p-1.5"
            : "border-brand-300/70 bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700 text-white dark:border-[#344457] dark:from-brand-400 dark:via-brand-500 dark:to-brand-800",
          classes.frame
        )}
      >
        {hasLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl ?? ""}
            alt={businessName ? `Logo de ${businessName}` : "Logo del comercio"}
            className="h-full w-full object-contain"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <DefaultMark iconClassName={classes.icon} />
        )}
      </div>
      {!collapsed ? (
        <div className="min-w-0">
          <p
            className={cn(
              "truncate font-black text-[var(--text-primary)]",
              hasLogo ? "tracking-normal" : "uppercase tracking-[0.1em]",
              classes.title
            )}
            title={title}
          >
            {title}
          </p>
          <p
            className={cn("truncate font-semibold text-brand-700 dark:text-brand-300", classes.subtitle)}
            title={description}
          >
            {description}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function DefaultMark({ iconClassName }: { iconClassName: string }) {
  return (
    <>
      <span className="absolute left-0 top-0 h-full w-1 bg-signal-accent" />
      <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-signal-accent shadow-sm shadow-signal-accent/40" />
      <svg viewBox="0 0 32 32" aria-hidden="true" className={iconClassName} fill="none">
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
    </>
  );
}
