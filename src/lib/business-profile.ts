import { BusinessType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const BUSINESS_PROFILE_ID = "default";

export type BusinessProfileView = {
  id: string;
  name: string;
  businessType: BusinessType;
  cuit: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  fiscalCondition: string | null;
  grossIncome: string | null;
  activityStartDate: Date | null;
  currency: string;
  locale: string;
  timezone: string;
  preferredTheme: string | null;
  logoUrl: string | null;
  website: string | null;
  generalFooterText: string | null;
};

export function getDefaultBusinessProfile(): BusinessProfileView {
  return {
    id: BUSINESS_PROFILE_ID,
    name: "POS Universal",
    businessType: BusinessType.KIOSK,
    cuit: null,
    address: null,
    phone: null,
    email: null,
    fiscalCondition: null,
    grossIncome: null,
    activityStartDate: null,
    currency: "ARS",
    locale: "es-AR",
    timezone: "America/Argentina/Buenos_Aires",
    preferredTheme: null,
    logoUrl: null,
    website: null,
    generalFooterText: null
  };
}

export async function getBusinessProfileOrDefault() {
  return (
    (await prisma.businessProfile.findUnique({
      where: { id: BUSINESS_PROFILE_ID }
    })) ?? getDefaultBusinessProfile()
  );
}
