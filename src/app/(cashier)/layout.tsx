import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/auth";
import {
  businessTypeLabel,
  getBusinessProfileOrDefault
} from "@/lib/business-profile";

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

  if (user.role !== Role.OWNER && user.role !== Role.ADMIN && user.role !== Role.CASHIER) {
    redirect("/login");
  }

  const businessProfile = await getBusinessProfileOrDefault(user.businessId ?? undefined);

  return (
    <AppShell
      user={user}
      defaultSidebarOpen={false}
      businessProfile={{
        name: businessProfile.name,
        logoUrl: businessProfile.logoUrl,
        subtitle: businessTypeLabel(businessProfile.businessType)
      }}
    >
      {children}
    </AppShell>
  );
}
