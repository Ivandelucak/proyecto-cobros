export {};

declare global {
  type PosElectronPrinter = {
    name: string;
    displayName: string;
    isDefault: boolean;
    status?: number;
  };

  type PosElectronPrintOptions = {
    printerName?: string | null;
    paperSize?: "TICKET_80" | "TICKET_58" | "A4";
    silent?: boolean;
    copies?: number;
    marginMm?: number;
  };

  interface Window {
    posElectron?: {
      isElectron: true;
      getPrinters: () => Promise<PosElectronPrinter[]>;
      printTicket: (
        ticketUrlOrSaleId: string,
        options?: PosElectronPrintOptions
      ) => Promise<{ ok: true } | { ok: false; error: string }>;
    };
  }
}
