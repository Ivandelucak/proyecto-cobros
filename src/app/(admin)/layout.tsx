import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
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

  return <AppShell user={user} defaultSidebarOpen>{children}</AppShell>;
}
