"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/ui";

type RoleValue = "ADMIN" | "CASHIER";

const navItems = [
  { href: "/caja", label: "Caja" },
  { href: "/clientes", label: "Clientes", adminOnly: true },
  { href: "/productos", label: "Productos", adminOnly: true },
  { href: "/categorias", label: "Categorias", adminOnly: true },
  { href: "/stock", label: "Stock", adminOnly: true },
  { href: "/proveedores", label: "Proveedores", adminOnly: true },
  { href: "/compras", label: "Compras", adminOnly: true },
  { href: "/ventas", label: "Ventas", cashierLabel: "Mis ventas" },
  { href: "/facturacion", label: "Facturacion", adminOnly: true },
  { href: "/reportes", label: "Reportes", adminOnly: true },
  { href: "/usuarios", label: "Usuarios", adminOnly: true },
  { href: "/auditoria", label: "Auditoria", adminOnly: true },
  { href: "/configuracion", label: "Configuracion", adminOnly: true }
];

export function AdminNav({ role, compact = false }: { role: RoleValue; compact?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className={cn("space-y-1", compact ? "mt-6" : "mt-8")}>
      {navItems
        .filter((item) => role === "ADMIN" || !item.adminOnly)
        .map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const label =
            role === "CASHIER" && item.cashierLabel ? item.cashierLabel : item.label;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={label}
              className={cn(
                "block rounded-md font-medium transition duration-150",
                compact ? "px-2 py-2 text-sm" : "px-3 py-2 text-sm",
                active
                  ? "bg-brand-100/70 text-brand-800 font-semibold ring-1 ring-brand-200/80 dark:bg-brand-600/20 dark:text-white dark:ring-brand-500/30"
                  : "text-gray-700 hover:bg-slate-100 hover:text-gray-950 dark:text-gray-300 dark:hover:bg-neutral-800 dark:hover:text-white"
              )}
            >
              {label}
            </Link>
          );
        })}
    </nav>
  );
}
