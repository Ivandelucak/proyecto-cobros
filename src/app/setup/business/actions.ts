"use server";

import { createHmac, timingSafeEqual } from "node:crypto";
import { hashPassword } from "@/lib/auth";
import { createEmptyBusiness } from "@/lib/business-setup";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { slugify } from "@/lib/business-category-templates";

export type SetupAccessState = {
  error?: string;
};

export type CreateBusinessState = {
  success?: boolean;
  error?: string;
};

const ENABLE_SETUP_PAGE = process.env.ENABLE_SETUP_PAGE !== "false";
const SETUP_ACCESS_COOKIE = "foxpoint_setup_access";
const SETUP_ACCESS_MAX_AGE_SECONDS = 30 * 60;

export async function validateSetupAccessAction(
  _prevState: SetupAccessState,
  formData: FormData
): Promise<SetupAccessState> {
  if (!ENABLE_SETUP_PAGE) {
    return { error: "El setup de comercios esta deshabilitado." };
  }

  const submittedKey = String(formData.get("setupKey") ?? "");
  if (!isValidSetupKey(submittedKey)) {
    return { error: "Clave de Setup/Admin incorrecta." };
  }

  const cookieStore = await cookies();
  cookieStore.set(SETUP_ACCESS_COOKIE, createSetupAccessToken(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/setup/business",
    maxAge: SETUP_ACCESS_MAX_AGE_SECONDS
  });

  redirect("/setup/business");
}

export async function clearSetupAccessAction() {
  const cookieStore = await cookies();
  cookieStore.set(SETUP_ACCESS_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/setup/business",
    maxAge: 0
  });

  redirect("/setup/business");
}

export async function hasValidSetupAccess() {
  if (!ENABLE_SETUP_PAGE) {
    return false;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SETUP_ACCESS_COOKIE)?.value;
  return isValidSetupAccessToken(token);
}

export async function createBusinessAction(
  _prevState: CreateBusinessState,
  formData: FormData
): Promise<CreateBusinessState> {
  if (!ENABLE_SETUP_PAGE) {
    return { error: "El setup de comercios esta deshabilitado." };
  }

  if (!(await hasValidSetupAccess())) {
    return { error: "La autorizacion de setup expiro. Ingresa la clave nuevamente." };
  }

  const businessName = String(formData.get("businessName") ?? "").trim();
  const ownerName = String(formData.get("ownerName") ?? "").trim();
  const ownerEmail = String(formData.get("ownerEmail") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const rubro = String(formData.get("rubro") ?? "OTRO");
  const preloadCategories = formData.get("preloadCategoriesActive") === "true";

  if (!businessName || !ownerName || !ownerEmail || !password) {
    return { error: "Todos los campos son requeridos." };
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: ownerEmail }
    });
    if (existingUser) {
      return { error: "Ya existe un usuario con este email." };
    }

    const passwordHash = await hashPassword(password);
    await createEmptyBusiness({
      name: businessName,
      ownerName,
      ownerEmail,
      ownerPasswordHash: passwordHash,
      rubro,
      preloadCategories
    });

    revalidatePath("/setup/business");
    return { success: true };
  } catch (err: any) {
    console.error("Error creating business:", err);
    return { error: err.message || "Error al crear el comercio." };
  }
}

export async function toggleBusinessActiveAction(businessId: string) {
  if (!ENABLE_SETUP_PAGE) {
    throw new Error("El setup de comercios esta deshabilitado.");
  }
  if (!(await hasValidSetupAccess())) {
    throw new Error("La autorizacion de setup expiro. Ingresa la clave nuevamente.");
  }

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) {
    throw new Error("Comercio no encontrado.");
  }

  await prisma.business.update({
    where: { id: businessId },
    data: { active: !business.active }
  });

  revalidatePath("/setup/business");
  return { success: true, active: !business.active };
}

export async function cleanDuplicateCategoriesAction(businessId: string) {
  if (!ENABLE_SETUP_PAGE) {
    throw new Error("El setup de comercios esta deshabilitado.");
  }
  if (!(await hasValidSetupAccess())) {
    throw new Error("La autorizacion de setup expiro. Ingresa la clave nuevamente.");
  }

  const categories = await prisma.category.findMany({
    where: { businessId },
    include: { products: true }
  });

  const groups = new Map<string, typeof categories>();
  for (const cat of categories) {
    const slug = slugify(cat.name);
    const existingGroup = groups.get(slug) || [];
    existingGroup.push(cat);
    groups.set(slug, existingGroup);
  }

  let cleanedCount = 0;
  for (const [_, list] of groups.entries()) {
    if (list.length <= 1) continue;

    list.sort((left, right) => {
      const prodDiff = right.products.length - left.products.length;
      if (prodDiff !== 0) return prodDiff;
      return left.createdAt.getTime() - right.createdAt.getTime();
    });

    const primary = list[0];
    const duplicates = list.slice(1);

    for (const dup of duplicates) {
      if (dup.products.length > 0) {
        await prisma.product.updateMany({
          where: { categoryId: dup.id },
          data: { categoryId: primary.id }
        });
      }
      await prisma.category.updateMany({
        where: { parentId: dup.id },
        data: { parentId: primary.id }
      });
      await prisma.category.delete({
        where: { id: dup.id }
      });
      cleanedCount++;
    }
  }

  return { success: true, cleanedCount };
}

export async function deleteBusinessAction(businessId: string, confirmName: string) {
  if (!ENABLE_SETUP_PAGE) {
    throw new Error("El setup de comercios esta deshabilitado.");
  }
  if (!(await hasValidSetupAccess())) {
    throw new Error("La autorizacion de setup expiro. Ingresa la clave nuevamente.");
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { users: true }
  });

  if (!business) {
    throw new Error("Comercio no encontrado.");
  }

  if (business.name.trim() !== confirmName.trim()) {
    throw new Error("El nombre de confirmacion no coincide con el comercio a eliminar.");
  }

  // Double safety: don't allow deleting a business if it looks like the initial main business.
  // We can check if it is the oldest business or has users who are the core owner.
  const allBusinesses = await prisma.business.findMany({
    orderBy: { createdAt: "asc" }
  });

  if (allBusinesses.length > 0 && allBusinesses[0].id === businessId) {
    throw new Error("No esta permitido eliminar el comercio principal/inicial del sistema.");
  }

  await prisma.$transaction(async (tx) => {
    // 1. Get fiscal documents to cascade delete their items and events
    const fiscalDocs = await tx.fiscalDocument.findMany({
      where: { sale: { businessId } },
      select: { id: true }
    });
    const fiscalDocIds = fiscalDocs.map((fd) => fd.id);

    if (fiscalDocIds.length > 0) {
      await tx.fiscalDocumentItem.deleteMany({
        where: { fiscalDocumentId: { in: fiscalDocIds } }
      });
    }

    // 2. Delete fiscal events
    await tx.fiscalEvent.deleteMany({
      where: {
        OR: [
          { sale: { businessId } },
          { fiscalDocumentId: { in: fiscalDocIds } }
        ]
      }
    });

    // 3. Delete fiscal documents (disconnect sale first)
    if (fiscalDocIds.length > 0) {
      await tx.sale.updateMany({
        where: { businessId },
        data: { fiscalDocumentId: null }
      });
      await tx.fiscalDocument.deleteMany({
        where: { id: { in: fiscalDocIds } }
      });
    }

    // 4. Delete SaleItems
    await tx.saleItem.deleteMany({
      where: { sale: { businessId } }
    });

    // 5. Delete Payments
    await tx.payment.deleteMany({
      where: { sale: { businessId } }
    });

    // 6. Delete CustomerAccountMovements
    await tx.customerAccountMovement.deleteMany({
      where: {
        OR: [
          { customer: { businessId } },
          { user: { businessId } }
        ]
      }
    });

    // 7. Delete Sales
    await tx.sale.deleteMany({
      where: { businessId }
    });

    // 8. Delete CashMovements
    await tx.cashMovement.deleteMany({
      where: { cashSession: { businessId } }
    });

    // 9. Delete CashSessions
    await tx.cashSession.deleteMany({
      where: { businessId }
    });

    // 10. Delete StockMovements
    await tx.stockMovement.deleteMany({
      where: { businessId }
    });

    // 11. Delete QuoteItems
    await tx.quoteItem.deleteMany({
      where: { quote: { businessId } }
    });

    // 12. Delete Quotes
    await tx.quote.deleteMany({
      where: { businessId }
    });

    // 13. Delete PurchaseItems
    await tx.purchaseItem.deleteMany({
      where: { purchase: { businessId } }
    });

    // 14. Delete Purchases
    await tx.purchase.deleteMany({
      where: { businessId }
    });

    // 15. Delete Products
    await tx.product.deleteMany({
      where: { businessId }
    });

    // 16. Delete Categories
    await tx.category.deleteMany({
      where: { businessId }
    });

    // 17. Delete Customers
    await tx.customer.deleteMany({
      where: { businessId }
    });

    // 18. Delete Suppliers
    await tx.supplier.deleteMany({
      where: { businessId }
    });

    // 19. Delete PaymentAttempts
    await tx.paymentAttempt.deleteMany({
      where: { businessId }
    });

    // 20. Delete PaymentMethodSettings
    await tx.paymentMethodSetting.deleteMany({
      where: { businessId }
    });

    // 21. Delete MercadoPagoAccounts
    await tx.mercadoPagoAccount.deleteMany({
      where: { businessId }
    });

    // 22. Delete PrintSettings
    await tx.printSetting.deleteMany({
      where: { businessId }
    });

    // 23. Delete TicketSettings
    await tx.ticketSetting.deleteMany({
      where: { businessId }
    });

    // 24. Delete CashRegisterSettings
    await tx.cashRegisterSetting.deleteMany({
      where: { businessId }
    });

    // 25. Delete StockSettings
    await tx.stockSetting.deleteMany({
      where: { businessId }
    });

    // 26. Delete FiscalSettings
    await tx.fiscalSetting.deleteMany({
      where: { businessId }
    });

    // 27. Delete AuditLogs
    await tx.auditLog.deleteMany({
      where: { businessId }
    });

    // 28. Delete BusinessProfiles
    await tx.businessProfile.deleteMany({
      where: { businessId }
    });

    // 29. Delete Users
    await tx.user.deleteMany({
      where: { businessId }
    });

    // 30. Delete Business
    await tx.business.delete({
      where: { id: businessId }
    });
  });

  revalidatePath("/setup/business");
  return { success: true };
}

function getSetupSecret() {
  return (
    process.env.SETUP_ADMIN_KEY ||
    (process.env.NODE_ENV === "production" ? "" : "development-only-change-me")
  );
}

function isValidSetupKey(submittedKey: string) {
  const setupSecret = getSetupSecret();
  if (!setupSecret || !submittedKey) {
    return false;
  }

  return safeEqual(submittedKey, setupSecret);
}

function createSetupAccessToken() {
  const expiresAt = Date.now() + SETUP_ACCESS_MAX_AGE_SECONDS * 1000;
  return `${expiresAt}.${signSetupAccess(String(expiresAt))}`;
}

function isValidSetupAccessToken(token: string | undefined) {
  if (!token) {
    return false;
  }

  const [expiresAt, signature] = token.split(".");
  const expiresAtNumber = Number(expiresAt);
  if (!expiresAt || !signature || !Number.isFinite(expiresAtNumber)) {
    return false;
  }

  if (expiresAtNumber <= Date.now()) {
    return false;
  }

  return safeEqual(signature, signSetupAccess(expiresAt));
}

function signSetupAccess(expiresAt: string) {
  const setupSecret = getSetupSecret();
  if (!setupSecret) {
    return "";
  }

  return createHmac("sha256", setupSecret)
    .update(`foxpoint:setup-business:${expiresAt}`)
    .digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
