import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/auth-actions";
import { AppLogo } from "@/components/brand/AppLogo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CashierLayout({
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
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-3 transition-colors duration-200 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center gap-5">
          <AppLogo compact />
          <div>
            <p className="text-sm font-medium text-gray-950 dark:text-gray-50">
              {user.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {user.email} - {user.role}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <LinkButton href="/caja">Caja</LinkButton>
          <LinkButton href="/productos">Productos</LinkButton>
          <LinkButton href="/ventas">Ventas</LinkButton>
          {user.role === Role.ADMIN ? <LinkButton href="/admin">Admin</LinkButton> : null}
          <ThemeToggle />
          <form action={logoutAction}>
            <Button type="submit">Cerrar sesion</Button>
          </form>
        </div>
      </header>

      <main className="p-6">{children}</main>
    </div>
  );
}
