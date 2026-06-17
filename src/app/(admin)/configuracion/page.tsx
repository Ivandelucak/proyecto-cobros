import { BusinessType } from "@prisma/client";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { BusinessProfileForm } from "./business-profile-form";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  await requireAdminPage();

  const profile = await prisma.businessProfile.findUnique({
    where: { id: "default" }
  });

  return (
    <section className="space-y-5">
      <PageHeader
        title="Configuracion"
        description="Datos basicos del comercio usados por ticket y operacion."
      />
      <BusinessProfileForm
        initialValues={{
          name: profile?.name ?? "POS Universal",
          businessType: profile?.businessType ?? BusinessType.KIOSK,
          cuit: profile?.cuit ?? null,
          address: profile?.address ?? null,
          phone: profile?.phone ?? null,
          currency: profile?.currency ?? "ARS",
          preferredTheme: profile?.preferredTheme ?? null,
          logoUrl: profile?.logoUrl ?? null
        }}
      />
    </section>
  );
}
