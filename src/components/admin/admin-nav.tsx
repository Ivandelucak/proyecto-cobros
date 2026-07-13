"use client";

import type { MouseEvent, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/ui";

import { Role } from "@prisma/client";

type NavGroup = "Operacion" | "Gestion" | "Control" | "Sistema";
type NavIcon =
  | "cash"
  | "people"
  | "box"
  | "tag"
  | "stock"
  | "truck"
  | "cart"
  | "quote"
  | "sales"
  | "invoice"
  | "chart"
  | "users"
  | "audit"
  | "settings";

const navItems = [
  { href: "/caja", label: "Caja", group: "Operacion", icon: "cash" },
  { href: "/ventas", label: "Ventas", cashierLabel: "Mis ventas", group: "Operacion", icon: "sales" },
  { href: "/presupuestos", label: "Presupuestos", group: "Operacion", icon: "quote" },
  { href: "/productos", label: "Productos", group: "Gestion", icon: "box" },
  { href: "/categorias", label: "Categorias", adminOnly: true, group: "Gestion", icon: "tag" },
  { href: "/stock", label: "Stock", group: "Gestion", icon: "stock" },
  { href: "/clientes", label: "Clientes", adminOnly: true, group: "Gestion", icon: "people" },
  { href: "/proveedores", label: "Proveedores", adminOnly: true, group: "Gestion", icon: "truck" },
  { href: "/compras", label: "Compras", adminOnly: true, group: "Gestion", icon: "cart" },
  { href: "/facturacion", label: "Facturacion", adminOnly: true, group: "Control", icon: "invoice" },
  { href: "/reportes", label: "Reportes", group: "Control", icon: "chart" },
  { href: "/auditoria", label: "Auditoria", adminOnly: true, group: "Control", icon: "audit" },
  { href: "/usuarios", label: "Usuarios", adminOnly: true, group: "Sistema", icon: "users" },
  { href: "/configuracion", label: "Configuracion", adminOnly: true, group: "Sistema", icon: "settings" }
] satisfies Array<{
  href: string;
  label: string;
  group: NavGroup;
  icon: NavIcon;
  adminOnly?: boolean;
  cashierLabel?: string;
}>;

export function AdminNav({
  role,
  compact = false,
  navigationLocked = false,
  onNavigationBlocked
}: {
  role: Role;
  compact?: boolean;
  navigationLocked?: boolean;
  onNavigationBlocked?: () => void;
}) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => role === Role.OWNER || role === Role.ADMIN || !item.adminOnly);
  const groups = Array.from(new Set(visibleItems.map((item) => item.group)));

  return (
    <nav className={cn("space-y-4", compact ? "mt-5 xl:mt-6" : "mt-6 2xl:mt-8")}>
      {groups.map((group) => (
        <div key={group} className="space-y-1.5">
          <p className="px-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
            {group}
          </p>
          {visibleItems
            .filter((item) => item.group === group)
            .map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const label =
            role === Role.CASHIER && item.cashierLabel ? item.cashierLabel : item.label;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={label}
              onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                if (navigationLocked && item.href !== "/caja") {
                  event.preventDefault();
                  onNavigationBlocked?.();
                }
              }}
              className={cn(
                "group relative flex min-w-0 items-center gap-2 overflow-hidden rounded-lg border font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                compact ? "px-2 py-2 text-xs xl:text-sm" : "px-2.5 py-2 text-xs lg:text-sm 2xl:px-3",
                active
                  ? "border-[color:var(--primary)] bg-[var(--primary-soft)] text-[var(--text-primary)] shadow-sm ring-1 ring-[color:var(--panel-border)]"
                  : "border-transparent text-[var(--text-secondary)] hover:translate-x-0.5 hover:border-[color:var(--panel-border)] hover:bg-[var(--panel-bg-elevated)] hover:text-[var(--text-primary)]"
              )}
            >
              <span
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-md border transition-colors duration-150",
                  active
                    ? "border-[color:var(--primary)] bg-[var(--panel-bg)] text-[var(--primary)] dark:text-[var(--text-primary)]"
                    : "border-[color:var(--panel-border)] bg-[var(--panel-bg-secondary)] text-[var(--text-muted)] group-hover:border-[color:var(--primary)] group-hover:text-[var(--primary)]"
                )}
                aria-hidden="true"
              >
                <NavIconGlyph icon={item.icon} />
              </span>
              <span className="truncate">{label}</span>
            </Link>
          );
            })}
        </div>
      ))}
    </nav>
  );
}

function NavIconGlyph({ icon }: { icon: NavIcon }) {
  const common = "stroke-current";
  const paths: Record<NavIcon, ReactNode> = {
    cash: <path d="M4 8h16v8H4zM7 12h.01M17 12h.01M12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />,
    people: <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3.5 19a4.5 4.5 0 0 1 9 0M13.5 19a3.5 3.5 0 0 1 7 0" />,
    box: <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Zm8 3.5 8-4M12 12 4 8m8 4v8" />,
    tag: <path d="M4 5h8l8 8-7 7-8-8V5Zm5 4h.01" />,
    stock: <path d="M5 19V9m5 10V5m5 14v-7m4 7H3" />,
    truck: <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />,
    cart: <path d="M4 5h2l2 10h9l2-7H7M9 19h.01M17 19h.01" />,
    quote: <path d="M6 4h12v16H6zM9 8h6M9 12h6M9 16h3" />,
    sales: <path d="M5 6h14M5 12h14M5 18h8M17 16l2 2 3-4" />,
    invoice: <path d="M7 4h10l2 2v14l-3-1.5-3 1.5-3-1.5L7 20V4Zm3 6h6m-6 4h6" />,
    chart: <path d="M4 19h16M7 16v-5m5 5V6m5 10v-8" />,
    users: <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6 8a6 6 0 0 0-12 0m14-8a2.5 2.5 0 0 0 0-5m2 13a4 4 0 0 0-3-3.8" />,
    audit: <path d="M6 4h12v16H6zM9 8h6M9 12h3m4 2 2 2 3-4" />,
    settings: <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v3m0 12v3m9-9h-3M6 12H3m15.4-6.4-2.1 2.1M7.7 16.3l-2.1 2.1m0-12.8 2.1 2.1m8.6 8.6 2.1 2.1" />
  };

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <g className={common} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {paths[icon]}
      </g>
    </svg>
  );
}
