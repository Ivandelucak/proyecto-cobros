import { PrintPaperSize } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const PRINT_SETTING_ID = "default";

export const printPaperSizeLabels: Record<PrintPaperSize, string> = {
  TICKET_80: "Ticket 80mm",
  TICKET_58: "Ticket 58mm",
  A4: "A4"
};

export type PrintSettingView = {
  printerName: string | null;
  paperSize: PrintPaperSize;
  silentPrint: boolean;
  autoPrintTicket: boolean;
  copies: number;
  marginMm: number;
};

export function getDefaultPrintSetting(): PrintSettingView {
  return {
    printerName: null,
    paperSize: PrintPaperSize.TICKET_80,
    silentPrint: false,
    autoPrintTicket: false,
    copies: 1,
    marginMm: 2
  };
}

export async function getPrintSetting(businessId?: string): Promise<PrintSettingView> {
  if (!businessId) {
    return getDefaultPrintSetting();
  }
  const setting = await prisma.printSetting.findUnique({
    where: { businessId }
  });

  return setting
    ? {
        printerName: setting.printerName,
        paperSize: setting.paperSize,
        silentPrint: setting.silentPrint,
        autoPrintTicket: setting.autoPrintTicket,
        copies: setting.copies,
        marginMm: setting.marginMm
      }
    : getDefaultPrintSetting();
}

export async function updatePrintSetting(businessId: string, input: PrintSettingView) {
  return prisma.printSetting.upsert({
    where: { businessId },
    update: input,
    create: {
      businessId,
      ...input
    }
  });
}

export function parsePrintPaperSize(value: FormDataEntryValue | null) {
  const text = String(value ?? "");
  if (!Object.values(PrintPaperSize).includes(text as PrintPaperSize)) {
    return PrintPaperSize.TICKET_80;
  }

  return text as PrintPaperSize;
}
