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
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Cerrar menu lateral"
          className="fixed inset-0 z-30 bg-slate-950/35 backdrop-blur-[1px] transition-opacity duration-200 md:hidden print:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div
        className={cn(
          "grid min-h-screen overflow-x-hidden md:transition-[grid-template-columns] md:duration-200",
          sidebarOpen
            ? "md:grid-cols-[190px_minmax(0,1fr)] lg:grid-cols-[212px_minmax(0,1fr)] 2xl:grid-cols-[240px_minmax(0,1fr)]"
            : "md:grid-cols-[minmax(0,1fr)]"
        )}
      >
        {sidebarOpen ? (
          <aside className="fixed inset-y-0 left-0 z-40 w-[224px] border-r border-slate-200 bg-white/95 px-3 py-4 shadow-2xl shadow-slate-950/15 backdrop-blur transition-[background-color,border-color,box-shadow] duration-200 dark:border-neutral-800 dark:bg-neutral-900/95 dark:shadow-black/30 md:static md:z-auto md:w-auto md:shadow-[2px_0_10px_rgba(15,23,42,0.03)] lg:px-3 2xl:px-4 2xl:py-5 print:hidden">
            <Link
              href={user.role === "ADMIN" ? "/admin" : "/caja"}
              title={user.role === "ADMIN" ? "Panel administrativo" : "Caja"}
              className="block rounded-md px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <AppLogo />
            </Link>
            <AdminNav role={user.role} />
          </aside>
        ) : null}

        <div className="flex min-w-0 flex-col overflow-x-hidden">
          <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-3 py-2.5 shadow-[0_2px_12px_rgba(15,23,42,0.04)] backdrop-blur transition-colors duration-200 dark:border-neutral-800 dark:bg-neutral-900/90 dark:shadow-none md:px-4 xl:px-5 xl:py-3 print:hidden">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                aria-label={sidebarOpen ? "Cerrar menu" : "Abrir menu"}
                aria-pressed={sidebarOpen}
                title={sidebarOpen ? "Cerrar menu" : "Abrir menu"}
                onClick={() => setSidebarOpen((current) => !current)}
                className={cn(
                  "group inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border text-slate-700 shadow-sm transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:shadow-md hover:shadow-slate-300/20 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:hover:shadow-none dark:focus-visible:ring-offset-neutral-900",
                  sidebarOpen
                    ? "border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-500/30 dark:bg-brand-600/20 dark:text-white"
                    : "border-slate-300 bg-white hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-gray-200 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
                )}
              >
                <span className="sr-only">
                  {sidebarOpen ? "Cerrar menu" : "Abrir menu"}
                </span>
                <span className="grid gap-1" aria-hidden="true">
                  <span className="block h-0.5 w-5 rounded-full bg-current transition-transform duration-150 group-hover:translate-x-0.5" />
                  <span className="block h-0.5 w-5 rounded-full bg-current transition-transform duration-150" />
                  <span className="block h-0.5 w-5 rounded-full bg-current transition-transform duration-150 group-hover:-translate-x-0.5" />
                </span>
              </button>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-950 dark:text-gray-50">
                  {user.name}
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {user.email} · {roleLabel(user.role)}
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

          <main className="min-w-0 flex-1 p-3 md:p-4 xl:p-5 2xl:p-6 print:p-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

function roleLabel(role: "ADMIN" | "CASHIER") {
  return role === "ADMIN" ? "Administrador" : "Cajero";
}
