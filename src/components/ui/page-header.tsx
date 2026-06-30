import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="pos-operational-strip flex min-w-0 flex-col gap-3 rounded-lg border px-4 py-3 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">
          POS Universal
        </p>
        <h1 className="mt-0.5 text-2xl font-black tracking-tight text-[var(--text-primary)]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2 md:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
