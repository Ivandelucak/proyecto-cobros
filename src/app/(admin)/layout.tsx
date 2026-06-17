import { Role } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/auth-actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { AppLogo } from "@/components/brand/AppLogo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== Role.ADMIN && user.role !== Role.CASHIER) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-950 transition-colors duration-200 dark:bg-neutral-950 dark:text-gray-50">
      <div className="grid min-h-screen grid-cols-[240px_1fr]">
        <aside className="border-r border-gray-200 bg-white px-4 py-5 transition-colors duration-200 dark:border-neutral-800 dark:bg-neutral-900">
          <Link
            href={user.role === Role.ADMIN ? "/admin" : "/caja"}
            className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <AppLogo />
          </Link>
          <AdminNav role={user.role} />
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 transition-colors duration-200 dark:border-neutral-800 dark:bg-neutral-900">
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

          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
