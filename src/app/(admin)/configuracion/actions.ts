"use server";

import { BusinessType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdminPage } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export type BusinessProfileState = {
  error?: string;
  success?: string;
};

export async function updateBusinessProfileAction(
  _prevState: BusinessProfileState,
  formData: FormData
): Promise<BusinessProfileState> {
  await requireAdminPage();

  try {
    const name = readText(formData, "name");
    if (!name) {
      throw new Error("El nombre del comercio es obligatorio.");
    }

    const businessType = String(formData.get("businessType") ?? BusinessType.KIOSK);
    if (!Object.values(BusinessType).includes(businessType as BusinessType)) {
      throw new Error("Rubro invalido.");
    }

    await prisma.businessProfile.upsert({
      where: { id: "default" },
      update: {
        name,
        businessType: businessType as BusinessType,
        cuit: readOptionalText(formData, "cuit"),
        address: readOptionalText(formData, "address"),
        phone: readOptionalText(formData, "phone"),
        currency: readText(formData, "currency") || "ARS",
        preferredTheme: readOptionalText(formData, "preferredTheme"),
        logoUrl: readOptionalText(formData, "logoUrl")
      },
      create: {
        id: "default",
        name,
        businessType: businessType as BusinessType,
        cuit: readOptionalText(formData, "cuit"),
        address: readOptionalText(formData, "address"),
        phone: readOptionalText(formData, "phone"),
        currency: readText(formData, "currency") || "ARS",
        preferredTheme: readOptionalText(formData, "preferredTheme"),
        logoUrl: readOptionalText(formData, "logoUrl")
      }
    });

    revalidatePath("/configuracion");
    revalidatePath("/ventas");

    return { success: "Configuracion guardada." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo guardar la configuracion."
    };
  }
}

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function readOptionalText(formData: FormData, key: string) {
  return readText(formData, key) || null;
}
