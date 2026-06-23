"use client";

import { useState } from "react";
import Link from "next/link";
import { logoutAction } from "@/app/auth-actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { AppLogo } from "@/components/brand/AppLogo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/ui";

type AppShellProps = {
  user: {
    name: string;
    email: string;
    role: "ADMIN" | "CASHIER";
  };
  children: React.ReactNode;
  defaultSidebarOpen?: boolean;
};

export function AppShell({
  user,
  children,
  defaultSidebarOpen = true
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(defaultSidebarOpen);

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-100 text-gray-950 transition-colors duration-200 dark:bg-neutral-950 dark:text-gray-50">
      <div
        className={cn(
          "grid min-h-screen overflow-x-hidden",
          sidebarOpen
            ? "grid-cols-[176px_minmax(0,1fr)] lg:grid-cols-[200px_minmax(0,1fr)] 2xl:grid-cols-[240px_minmax(0,1fr)]"
            : "grid-cols-[minmax(0,1fr)]"
        )}
      >
        {sidebarOpen ? (
          <aside className="border-r border-slate-200 bg-white px-2.5 py-4 shadow-[2px_0_8px_rgba(15,23,42,0.02)] transition-colors duration-200 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none lg:px-3 2xl:px-4 2xl:py-5">
            <Link
              href={user.role === "ADMIN" ? "/admin" : "/caja"}
              title={user.role === "ADMIN" ? "Panel administrativo" : "Caja"}
              className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <AppLogo />
            </Link>
            <AdminNav role={user.role} />
          </aside>
        ) : null}

        <div className="flex min-w-0 flex-col overflow-x-hidden">
          <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2.5 shadow-[0_2px_8px_rgba(15,23,42,0.02)] transition-colors duration-200 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none md:px-4 xl:px-5 xl:py-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                aria-label={sidebarOpen ? "Cerrar menú" : "Abrir menú"}
                aria-pressed={sidebarOpen}
                onClick={() => setSidebarOpen((current) => !current)}
                className={cn(
                  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border text-slate-700 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900",
                  sidebarOpen
                    ? "border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-500/30 dark:bg-brand-600/20 dark:text-white"
                    : "border-slate-300 bg-white hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-gray-200 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
                )}
              >
                <span className="sr-only">
                  {sidebarOpen ? "Cerrar menú" : "Abrir menú"}
                </span>
                <span className="grid gap-1" aria-hidden="true">
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                </span>
              </button>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-950 dark:text-gray-50">
                  {user.name}
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {user.email} - {user.role}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 xl:gap-3">
              <ThemeToggle />
              <form action={logoutAction}>
                <Button type="submit">Cerrar sesion</Button>
              </form>
            </div>
          </header>

          <main className="min-w-0 flex-1 p-3 md:p-4 2xl:p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
