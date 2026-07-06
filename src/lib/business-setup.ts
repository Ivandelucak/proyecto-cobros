import { prisma } from "@/lib/prisma";
import { Role, PaymentMethod, BusinessType, FiscalCustomerCondition, FiscalDocumentIdentityType, FiscalEnvironment, FiscalIssueMode, MercadoPagoOperationMode, PrintPaperSize } from "@prisma/client";

import { createSuggestedCategoriesForBusiness } from "./business-category-templates";

export type CreateBusinessParams = {
  name: string;
  ownerName: string;
  ownerEmail: string;
  ownerPasswordHash: string;
  rubro?: string;
  preloadCategories?: boolean;
};

export function mapRubroToBusinessType(rubro?: string): BusinessType {
  if (!rubro) return BusinessType.OTHER;
  const mapping: Record<string, BusinessType> = {
    KIOSKO: BusinessType.KIOSK,
    ALMACEN_SUPERMERCADO: BusinessType.GROCERY,
    BEBIDAS: BusinessType.BEVERAGE_STORE,
    ROPA: BusinessType.CLOTHING_STORE,
    MASCOTAS: BusinessType.PET_SHOP,
    LIBRERIA: BusinessType.BOOKSTORE,
    CARNICERIA: BusinessType.BUTCHER,
    FERRETERIA: BusinessType.HARDWARE_STORE,
    VERDULERIA: BusinessType.GREENGROCER,
    PANADERIA: BusinessType.OTHER,
    OTRO: BusinessType.OTHER
  };
  return mapping[rubro] ?? BusinessType.OTHER;
}

export async function createEmptyBusiness(params: CreateBusinessParams) {
  const { name, ownerName, ownerEmail, ownerPasswordHash, rubro, preloadCategories } = params;

  return prisma.$transaction(async (tx) => {
    // 1. Create Business
    const business = await tx.business.create({
      data: {
        name,
        active: true
      }
    });

    // 2. Create Owner User
    const user = await tx.user.create({
      data: {
        name: ownerName,
        email: ownerEmail.toLowerCase().trim(),
        passwordHash: ownerPasswordHash,
        role: Role.OWNER,
        businessId: business.id,
        active: true
      }
    });

    const mappedType = mapRubroToBusinessType(rubro);

    // 3. Create Business Profile
    await tx.businessProfile.create({
      data: {
        businessId: business.id,
        name,
        businessType: mappedType,
        currency: "ARS",
        locale: "es-AR",
        timezone: "America/Argentina/Buenos_Aires"
      }
    });

    // 3.5 Preload Suggested Categories if enabled
    if (preloadCategories && rubro) {
      await createSuggestedCategoriesForBusiness(tx, business.id, rubro);
    }

    // 4. Create Print Settings
    await tx.printSetting.create({
      data: {
        businessId: business.id,
        paperSize: PrintPaperSize.TICKET_80,
        silentPrint: false,
        autoPrintTicket: false,
        copies: 1,
        marginMm: 2
      }
    });

    // 5. Create Ticket Settings
    await tx.ticketSetting.create({
      data: {
        businessId: business.id,
        showBusinessName: true,
        showCuit: true,
        showAddress: true,
        showPhone: true,
        showEmail: false,
        showSeller: true,
        showCustomer: true,
        showPaymentDetails: true,
        showStockUnit: true,
        showBarcode: false,
        ticketTitle: "Comprobante interno",
        thankYouText: "Gracias por su compra",
        showNonFiscalLegend: true,
        nonFiscalLegend: "No fiscal"
      }
    });

    // 6. Create Cash Register Settings
    await tx.cashRegisterSetting.create({
      data: {
        businessId: business.id,
        requireOpenSession: true,
        showExpectedCashToCashier: false,
        allowCashierCancelSale: false,
        allowNegativeStock: false,
        quickProductsLimit: 12
      }
    });

    // 7. Create Stock Settings
    await tx.stockSetting.create({
      data: {
        businessId: business.id,
        lowStockEnabled: true,
        defaultMinStock: 0,
        allowManualStockAdjustment: true,
        showLowStockWarnings: true
      }
    });

    // 8. Create Fiscal Settings
    await tx.fiscalSetting.create({
      data: {
        businessId: business.id,
        enabled: false,
        environment: FiscalEnvironment.HOMOLOGACION,
        cashIssueMode: FiscalIssueMode.ASK,
        electronicPaymentIssueMode: FiscalIssueMode.AUTO,
        currentAccountIssueMode: FiscalIssueMode.ASK,
        pendingWarningMinutes: 30,
        pendingCriticalMinutes: 120,
        allowCancelBeforeIssue: true,
        requireCustomerForInvoiceA: true,
        defaultCustomerDocType: FiscalDocumentIdentityType.CONSUMIDOR_FINAL
      }
    });

    // 9. Create default Payment Methods Settings
    const paymentMethodsData = [
      { method: PaymentMethod.CASH, label: "Efectivo", enabled: true, sortOrder: 1 },
      { method: PaymentMethod.DEBIT, label: "Débito", enabled: false, sortOrder: 2 },
      { method: PaymentMethod.CREDIT, label: "Crédito", enabled: false, sortOrder: 3 },
      { method: PaymentMethod.TRANSFER, label: "Transferencia", enabled: false, sortOrder: 4 },
      { method: PaymentMethod.MERCADOPAGO, label: "Mercado Pago", enabled: false, sortOrder: 5 },
      { method: PaymentMethod.CURRENT_ACCOUNT, label: "Cuenta corriente", enabled: false, sortOrder: 6 }
    ];

    for (const pm of paymentMethodsData) {
      await tx.paymentMethodSetting.create({
        data: {
          businessId: business.id,
          method: pm.method,
          label: pm.label,
          enabled: pm.enabled,
          sortOrder: pm.sortOrder
        }
      });
    }

    return { business, user };
  });
}
