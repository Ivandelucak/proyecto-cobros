"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/ui";

type RoleValue = "ADMIN" | "CASHIER";

const navItems = [
  { href: "/caja", label: "Caja" },
  { href: "/productos", label: "Productos" },
  { href: "/categorias", label: "Categorias", adminOnly: true },
  { href: "/stock", label: "Stock", adminOnly: true },
  { href: "/ventas", label: "Ventas" },
  { href: "/reportes", label: "Reportes", adminOnly: true },
  { href: "/configuracion", label: "Configuracion", adminOnly: true }
];

export function AdminNav({ role }: { role: RoleValue }) {
  const pathname = usePathname();

  return (
    <nav className="mt-8 space-y-1">
      {navItems
        .filter((item) => role === "ADMIN" || !item.adminOnly)
        .map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-md px-3 py-2 text-sm font-medium transition duration-150",
                active
                  ? "bg-brand-50 text-brand-700 ring-1 ring-brand-100 dark:bg-brand-600/20 dark:text-white dark:ring-brand-500/30"
                  : "text-gray-700 hover:bg-gray-100 hover:text-gray-950 dark:text-gray-300 dark:hover:bg-neutral-800 dark:hover:text-white"
              )}
            >
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}
