"use client";

import { useState } from "react";
import Link from "next/link";
import { logoutAction } from "@/app/auth-actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { AppBrandCenter } from "@/components/brand/AppBrandCenter";
import { BusinessBrand } from "@/components/brand/BusinessBrand";
import { BusinessHeaderIdentity } from "@/components/brand/BusinessHeaderIdentity";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/branding";
import { cn } from "@/lib/ui";

import { Role } from "@prisma/client";

type AppShellProps = {
  user: {
    name: string;
    email: string;
    role: Role;
  };
  children: React.ReactNode;
  defaultSidebarOpen?: boolean;
  businessProfile?: {
    name: string;
    logoUrl: string | null;
    subtitle: string;
    headerImageUrl?: string | null;
  };
};

export function AppShell({
  user,
  children,
  defaultSidebarOpen = true,
  businessProfile
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(defaultSidebarOpen);
  const businessName = businessProfile?.name ?? APP_NAME;
  const businessImageUrl = businessProfile?.headerImageUrl ?? businessProfile?.logoUrl ?? null;

  const roleChipLabel =
    user.role === Role.OWNER
      ? "Dueño"
      : user.role === Role.CASHIER
      ? "Caja operativa"
      : user.role === Role.VIEWER
      ? "Visualizador"
      : "Admin operativo";

  return (
    <div className="app-shell min-h-screen overflow-x-hidden transition-colors duration-200">
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
          <aside className="fixed inset-y-0 left-0 z-40 w-[232px] border-r border-[color:var(--panel-border)] bg-[var(--panel-bg)]/95 px-3 py-4 shadow-2xl shadow-slate-950/15 backdrop-blur transition-[background-color,border-color,box-shadow] duration-200 dark:bg-[#0B1015]/98 dark:shadow-black/30 md:static md:z-auto md:w-auto md:shadow-[2px_0_18px_rgba(11,16,21,0.22)] lg:px-3 2xl:px-4 2xl:py-5 print:hidden relative">
            <div className="absolute inset-y-0 right-0 hidden w-px bg-gradient-to-b from-transparent via-[#344457] to-transparent dark:block" aria-hidden="true" />
            <Link
              href={user.role === "ADMIN" ? "/admin" : "/caja"}
              title={user.role === "ADMIN" ? "Panel administrativo" : "Caja"}
              className="block rounded-lg px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <BusinessBrand
                logoUrl={businessProfile?.logoUrl}
                businessName={businessProfile?.name}
                subtitle={businessProfile?.subtitle}
              />
            </Link>
            <div className="app-panel-secondary mt-4 rounded-lg px-3 py-2 text-xs text-[var(--text-secondary)]">
              <p className="font-black uppercase tracking-[0.14em] text-[var(--text-primary)]">
                {user.role === "CASHIER" ? "Modo caja" : "Centro operativo"}
              </p>
              <p className="mt-1 truncate">
                {user.role === "CASHIER" ? "Listo para cobrar" : "Gestion comercial"}
              </p>
            </div>
            <AdminNav role={user.role} />
          </aside>
        ) : null}

        <div className="flex min-w-0 flex-col overflow-x-hidden">
          <header className="pos-operational-strip grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b px-3 py-2.5 backdrop-blur transition-colors duration-200 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:px-4 xl:px-5 xl:py-3 print:hidden">
            <div className="flex min-w-0 items-center gap-3 justify-self-start">
              <button
                type="button"
                aria-label={sidebarOpen ? "Cerrar menu" : "Abrir menu"}
                aria-pressed={sidebarOpen}
                title={sidebarOpen ? "Cerrar menu" : "Abrir menu"}
                onClick={() => setSidebarOpen((current) => !current)}
                className={cn(
                  "group inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border shadow-sm transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:shadow-md hover:shadow-slate-300/20 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 dark:hover:shadow-none dark:focus-visible:ring-offset-[#0B1015]",
                  sidebarOpen
                    ? "border-[color:var(--primary)] bg-[var(--primary-soft)] text-[var(--text-primary)]"
                    : "btn-secondary"
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

              <BusinessHeaderIdentity
                businessName={businessName}
                subtitle={businessProfile?.subtitle}
                imageUrl={businessImageUrl}
                userName={user.name}
                imageFit="contain"
                className="max-w-[58vw] sm:max-w-[360px] xl:max-w-[460px]"
              />
              <div
                className="badge-info hidden rounded-full px-3 py-1 text-xs font-bold lg:inline-flex"
                title={`${user.email} - ${roleLabel(user.role)}`}
              >
                {roleChipLabel}
              </div>
            </div>

            <AppBrandCenter className="hidden md:block" />

            <div className="col-start-2 flex shrink-0 items-center gap-2 justify-self-end md:col-start-3 xl:gap-3">
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

function roleLabel(role: Role) {
  if (role === Role.OWNER) return "Dueño";
  if (role === Role.ADMIN) return "Administrador";
  if (role === Role.CASHIER) return "Cajero";
  return "Visualizador";
}
