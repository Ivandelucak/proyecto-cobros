import { prisma } from "@/lib/prisma";

export const TICKET_SETTING_ID = "default";

export type TicketSettingView = {
  showBusinessName: boolean;
  showCuit: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showEmail: boolean;
  showSeller: boolean;
  showCustomer: boolean;
  showPaymentDetails: boolean;
  showStockUnit: boolean;
  showBarcode: boolean;
  footerText: string | null;
  headerText: string | null;
  ticketTitle: string;
  thankYouText: string;
  showNonFiscalLegend: boolean;
  nonFiscalLegend: string;
};

export function getDefaultTicketSetting(): TicketSettingView {
  return {
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
    footerText: null,
    headerText: null,
    ticketTitle: "Ticket no fiscal",
    thankYouText: "Gracias por su compra",
    showNonFiscalLegend: true,
    nonFiscalLegend: "Ticket no fiscal"
  };
}

export async function getTicketSetting(businessId?: string) {
  if (!businessId) {
    return getDefaultTicketSetting();
  }
  const setting = await prisma.ticketSetting.findUnique({
    where: { businessId }
  });

  return setting ?? { ...getDefaultTicketSetting(), businessId, id: businessId };
}
