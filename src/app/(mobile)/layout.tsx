import { requireMobileAuth } from "@/lib/admin-auth";
import { getBusinessProfileOrDefault } from "@/lib/business-profile";
import { MobileAppShell } from "@/components/mobile/MobileAppShell";

export const dynamic = "force-dynamic";

export default async function MobileLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireMobileAuth();
  const businessProfile = await getBusinessProfileOrDefault(user.businessId ?? undefined);

  return (
    <MobileAppShell
      businessName={businessProfile.name}
      logoUrl={businessProfile.logoUrl}
    >
      {children}
    </MobileAppShell>
  );
}
