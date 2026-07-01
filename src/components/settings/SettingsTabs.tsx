"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/ui";

const settingsTabs = [
  {
    href: "/configuracion",
    label: "General",
    exact: true
  },
  {
    href: "/configuracion/pagos",
    label: "Pagos"
  },
  {
    href: "/configuracion/fiscal",
    label: "Fiscal"
  },
  {
    href: "/configuracion/impresion",
    label: "Impresion"
  },
  {
    href: "/configuracion/mantenimiento",
    label: "Mantenimiento"
  }
];

export function SettingsTabs() {
  const pathname = usePathname();

  return (
    <nav className="app-panel-secondary overflow-x-auto rounded-lg p-1.5">
      <div className="flex min-w-max gap-1.5">
        {settingsTabs.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "rounded-md border px-3 py-2 text-sm font-semibold transition-[background-color,border-color,color] duration-150",
                active
                  ? "border-[color:var(--primary)] bg-[var(--primary-soft)] text-[var(--text-primary)]"
                  : "border-transparent text-[var(--text-secondary)] hover:border-[color:var(--panel-border)] hover:bg-[var(--panel-bg-elevated)] hover:text-[var(--text-primary)]"
              )}
              aria-current={active ? "page" : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
