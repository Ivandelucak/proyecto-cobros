import { Role } from "@prisma/client";
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
    role: Role;
  };
  children: React.ReactNode;
  compactSidebar?: boolean;
};

export function AppShell({ user, children, compactSidebar = false }: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-100 text-gray-950 transition-colors duration-200 dark:bg-neutral-950 dark:text-gray-50">
      <div
        className={cn(
          "grid min-h-screen",
          compactSidebar
            ? "grid-cols-[84px_minmax(0,1fr)]"
            : "grid-cols-[240px_minmax(0,1fr)]"
        )}
      >
        <aside
          className={cn(
            "border-r border-slate-200 bg-white shadow-[2px_0_8px_rgba(15,23,42,0.02)] transition-colors duration-200 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none",
            compactSidebar ? "px-2 py-4" : "px-4 py-5"
          )}
        >
          <Link
            href={user.role === Role.ADMIN ? "/admin" : "/caja"}
            title={user.role === Role.ADMIN ? "Panel administrativo" : "Caja"}
            className={cn(
              "block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
              compactSidebar && "flex justify-center"
            )}
          >
            <AppLogo compact={compactSidebar} />
          </Link>
          <AdminNav role={user.role} compact={compactSidebar} />
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3 shadow-[0_2px_8px_rgba(15,23,42,0.02)] transition-colors duration-200 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
            <div>
              <p className="text-sm font-medium text-gray-950 dark:text-gray-50">
                {user.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {user.email} - {user.role}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />
              <form action={logoutAction}>
                <Button type="submit">Cerrar sesion</Button>
              </form>
            </div>
          </header>

          <main className={cn("flex-1", compactSidebar ? "p-4 xl:p-5" : "p-6")}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
