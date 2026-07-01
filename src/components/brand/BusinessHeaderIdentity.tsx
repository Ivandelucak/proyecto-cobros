"use client";

import { useMemo, useState } from "react";
import { APP_NAME } from "@/lib/branding";
import { cn } from "@/lib/ui";

type BusinessHeaderIdentityProps = {
  businessName?: string | null;
  subtitle?: string | null;
  imageUrl?: string | null;
  userName?: string | null;
  imageFit?: "contain" | "cover";
  className?: string;
};

export function BusinessHeaderIdentity({
  businessName,
  subtitle,
  imageUrl,
  userName,
  imageFit = "contain",
  className
}: BusinessHeaderIdentityProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const title = businessName?.trim() || APP_NAME;
  const hasImage = Boolean(imageUrl) && !imageFailed;
  const fallbackInitial = useMemo(() => initialFor(title), [title]);
  const secondary = [subtitle?.trim(), userName ? `Operado por ${userName}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <div className="grid h-[38px] w-[52px] shrink-0 place-items-center overflow-hidden rounded-[10px] border border-[color:var(--panel-border-strong)] bg-[var(--panel-bg-elevated)] p-0.5 shadow-sm shadow-slate-950/10 dark:shadow-none">
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl ?? ""}
            alt={`Imagen de ${title}`}
            className={cn(
              "h-full w-full",
              imageFit === "cover" ? "object-cover" : "object-contain"
            )}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="grid h-full w-full place-items-center rounded-lg bg-[var(--primary-soft)] text-sm font-black uppercase text-[var(--primary)]">
            {fallbackInitial}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p
          className="truncate text-sm font-black leading-5 text-[var(--text-primary)]"
          title={title}
        >
          {title}
        </p>
        <p
          className="truncate text-xs leading-4 text-[var(--text-secondary)]"
          title={secondary || undefined}
        >
          {secondary || "Comercio"}
        </p>
      </div>
    </div>
  );
}

function initialFor(value: string) {
  const normalized = value.trim();
  return normalized ? normalized.charAt(0) : "P";
}
