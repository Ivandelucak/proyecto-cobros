import Link from "next/link";
import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/ui";
import { Card } from "./card";

type SettingsTone = "info" | "success" | "warning" | "danger" | "neutral";

export function SettingsNav({
  items,
  currentHref
}: {
  items: Array<{ href: string; label: string; description?: string }>;
  currentHref: string;
}) {
  return (
    <nav className="app-panel-secondary overflow-x-auto rounded-lg p-1.5">
      <div className="flex min-w-max gap-1.5">
        {items.map((item) => {
          const active = item.href === currentHref;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md border px-3 py-2 text-sm font-semibold transition-[background-color,border-color,color] duration-150",
                active
                  ? "border-[color:var(--primary)] bg-[var(--primary-soft)] text-[var(--text-primary)]"
                  : "border-transparent text-[var(--text-secondary)] hover:border-[color:var(--panel-border)] hover:bg-[var(--panel-bg-elevated)] hover:text-[var(--text-primary)]"
              )}
              title={item.description}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function SettingsSection({
  title,
  description,
  eyebrow,
  actions,
  children,
  className
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="text-base font-black tracking-tight text-[var(--text-primary)]">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function SettingsCard({
  children,
  className,
  elevated = false
}: {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
}) {
  return (
    <Card className={cn(elevated ? "app-panel-elevated" : "app-panel", "p-4 sm:p-5", className)}>
      {children}
    </Card>
  );
}

export function SettingsGrid({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("grid gap-4 md:grid-cols-2", className)}>{children}</div>;
}

export function SettingsField({
  label,
  description,
  error,
  className,
  children
}: {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block space-y-2", className)}>
      <span className="block text-sm font-semibold text-[var(--text-primary)]">{label}</span>
      {description ? (
        <span className="block text-xs leading-5 text-[var(--text-muted)]">{description}</span>
      ) : null}
      {children}
      {error ? <span className="block text-xs text-[var(--danger)]">{error}</span> : null}
    </label>
  );
}

export function SettingsSwitchRow({
  name,
  defaultChecked,
  label,
  description,
  disabled,
  tone = "neutral",
  className,
  inputProps
}: {
  name: string;
  defaultChecked?: boolean;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  tone?: SettingsTone;
  className?: string;
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "name" | "defaultChecked" | "disabled">;
}) {
  return (
    <label
      className={cn(
        "group flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition-[background-color,border-color,color] duration-150",
        disabled
          ? "cursor-not-allowed border-[color:var(--panel-border)] bg-[var(--panel-bg-secondary)] opacity-70"
          : "border-[color:var(--panel-border)] bg-[var(--panel-bg)] hover:border-[color:var(--panel-border-strong)] hover:bg-[var(--panel-bg-elevated)]",
        tone === "danger" && "hover:border-[color:var(--danger)]",
        className
      )}
    >
      <span className="min-w-0">
        <span className="block font-semibold text-[var(--text-primary)]">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-5 text-[var(--text-muted)]">
            {description}
          </span>
        ) : null}
      </span>
      <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          disabled={disabled}
          className="peer sr-only"
          {...inputProps}
        />
        <span className="absolute inset-0 rounded-full border border-[color:var(--panel-border-strong)] bg-[var(--panel-bg-secondary)] transition-colors peer-checked:border-[color:var(--primary)] peer-checked:bg-[var(--primary)] peer-focus-visible:ring-2 peer-focus-visible:ring-[color:var(--primary)] peer-disabled:opacity-60" />
        <span className="absolute left-1 h-4 w-4 rounded-full bg-[var(--text-muted)] shadow-sm transition-transform peer-checked:translate-x-5 peer-checked:bg-white" />
      </span>
    </label>
  );
}

export function SettingsRadioRow({
  name,
  value,
  defaultChecked,
  label,
  description,
  className
}: {
  name: string;
  value: string;
  defaultChecked?: boolean;
  label: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border border-[color:var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2.5 text-sm transition hover:border-[color:var(--primary)] hover:bg-[var(--panel-bg-elevated)]",
        className
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="mt-1 h-4 w-4 border-[color:var(--panel-border-strong)] text-brand-600 focus:ring-brand-500"
      />
      <span className="min-w-0">
        <span className="block font-semibold text-[var(--text-primary)]">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-5 text-[var(--text-muted)]">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export function SettingsAdvancedDetails({
  title = "Opciones avanzadas",
  description,
  children,
  defaultOpen = false,
  className
}: {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details
      className={cn("app-panel-secondary rounded-lg p-3", className)}
      open={defaultOpen}
    >
      <summary className="cursor-pointer list-none text-sm font-bold text-[var(--text-primary)]">
        <span className="inline-flex items-center gap-2">
          {title}
          <span className="text-xs font-semibold text-[var(--text-muted)]">Abrir</span>
        </span>
      </summary>
      {description ? (
        <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{description}</p>
      ) : null}
      <div className="mt-3">{children}</div>
    </details>
  );
}

export function SettingsStatusBadge({
  tone = "info",
  children
}: {
  tone?: SettingsTone;
  children: ReactNode;
}) {
  const classes: Record<SettingsTone, string> = {
    info: "badge-info",
    success: "badge-success",
    warning: "badge-warning",
    danger: "badge-danger",
    neutral: "badge-neutral"
  };
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-bold", classes[tone])}>
      {children}
    </span>
  );
}

export function SettingsAlert({
  tone = "info",
  children,
  className
}: {
  tone?: SettingsTone;
  children: ReactNode;
  className?: string;
}) {
  const classes: Record<SettingsTone, string> = {
    info: "badge-info",
    success: "badge-success",
    warning: "badge-warning",
    danger: "badge-danger",
    neutral: "badge-neutral"
  };
  return (
    <div className={cn("rounded-lg border px-3 py-2 text-sm leading-6", classes[tone], className)}>
      {children}
    </div>
  );
}

export function SettingsSummaryCard({
  label,
  value,
  hint,
  tone = "neutral"
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: SettingsTone;
}) {
  return (
    <div className="app-panel-secondary rounded-lg px-3 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">{value}</p>
      {hint ? (
        <p
          className={cn(
            "mt-1 text-xs leading-5",
            tone === "success" && "text-[var(--success)]",
            tone === "warning" && "text-[var(--warning)]",
            tone === "danger" && "text-[var(--danger)]",
            tone !== "success" && tone !== "warning" && tone !== "danger" && "text-[var(--text-muted)]"
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SettingsSaveBar({
  children,
  message = "Los cambios se aplican al guardar."
}: {
  children: ReactNode;
  message?: ReactNode;
}) {
  return (
    <div className="sticky bottom-3 z-10 rounded-lg border border-[color:var(--panel-border)] bg-[var(--panel-bg)]/95 p-3 shadow-lg shadow-slate-950/10 backdrop-blur dark:shadow-none">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--text-secondary)]">{message}</p>
        <div className="flex flex-wrap gap-2">{children}</div>
      </div>
    </div>
  );
}
