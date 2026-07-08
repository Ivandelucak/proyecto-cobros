/* global __dirname, clearTimeout, console, process, require, setTimeout, URL */

const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow, ipcMain, shell } = require("electron");

const APP_NAME = "Fox Point";
const APP_ID = "com.foxpoint.pos";
const DEFAULT_APP_URL = "https://app.foxpoint.com.ar";
const LOCAL_DEV_ORIGIN = "http://localhost:3000";
const BACKGROUND_COLOR = "#0B1015";

const isDevelopment = !app.isPackaged;
const isSmokeTest = process.env.ELECTRON_SMOKE_TEST === "1";
const allowedPaperSizes = new Set(["TICKET_80", "TICKET_58", "A4"]);

let mainWindow = null;
let cachedStartUrl = null;

if (process.platform === "win32") {
  app.setAppUserModelId(APP_ID);
}

function createMainWindow() {
  const startUrl = getStartUrl();

  mainWindow = new BrowserWindow({
    title: APP_NAME,
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: BACKGROUND_COLOR,
    autoHideMenuBar: true,
    resizable: true,
    maximizable: true,
    show: false,
    icon: getWindowIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  mainWindow.setMenuBarVisibility(false);

  mainWindow.once("ready-to-show", () => {
    if (!isSmokeTest) {
      mainWindow?.show();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedAppUrl(url)) {
      event.preventDefault();
      openExternalUrl(url);
    }
  });

  if (isDevelopment && process.env.ELECTRON_OPEN_DEVTOOLS === "1") {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  if (isSmokeTest) {
    mainWindow.webContents.once("did-finish-load", () => {
      app.quit();
    });
    mainWindow.webContents.once(
      "did-fail-load",
      (_event, errorCode, errorDescription) => {
        console.error(`Electron smoke test failed: ${errorCode} ${errorDescription}`);
        app.exit(1);
      }
    );
  }

  void mainWindow.loadURL(startUrl);
}

function getStartUrl() {
  if (cachedStartUrl) {
    return cachedStartUrl;
  }

  cachedStartUrl = resolveAllowedAppUrl(
    process.env.ELECTRON_APP_URL || process.env.ELECTRON_START_URL
  );
  return cachedStartUrl;
}

function resolveAllowedAppUrl(rawUrl) {
  const fallbackUrl = DEFAULT_APP_URL;

  if (!rawUrl) {
    return fallbackUrl;
  }

  try {
    const parsedUrl = new URL(rawUrl);
    const defaultOrigin = new URL(DEFAULT_APP_URL).origin;

    if (parsedUrl.origin === defaultOrigin) {
      return parsedUrl.toString();
    }

    if (isDevelopment && parsedUrl.origin === LOCAL_DEV_ORIGIN) {
      return parsedUrl.toString();
    }

    console.warn(
      `ELECTRON_APP_URL ignorada: origen no permitido (${parsedUrl.origin}).`
    );
  } catch {
    console.warn("ELECTRON_APP_URL ignorada: URL invalida.");
  }

  return fallbackUrl;
}

function isAllowedAppUrl(url) {
  try {
    const parsedUrl = new URL(url);
    const defaultOrigin = new URL(DEFAULT_APP_URL).origin;
    const appOrigin = new URL(getStartUrl()).origin;

    if (parsedUrl.origin === defaultOrigin || parsedUrl.origin === appOrigin) {
      return true;
    }

    return isDevelopment && appOrigin === LOCAL_DEV_ORIGIN && parsedUrl.origin === LOCAL_DEV_ORIGIN;
  } catch {
    return false;
  }
}

function openExternalUrl(url) {
  try {
    const parsedUrl = new URL(url);
    if (["https:", "http:", "mailto:"].includes(parsedUrl.protocol)) {
      void shell.openExternal(parsedUrl.toString());
    }
  } catch {
    // Ignora URLs malformadas.
  }
}

function getWindowIconPath() {
  const iconPath = path.join(__dirname, "assets", "icon-256x256.png");
  return fs.existsSync(iconPath) ? iconPath : undefined;
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function registerIpcHandlers() {
  ipcMain.handle("pos:is-electron", () => true);

  ipcMain.handle("pos:get-printers", async (event) => {
    const printers = await event.sender.getPrintersAsync();

    return printers.map((printer) => ({
      name: printer.name,
      displayName: printer.displayName || printer.name,
      isDefault: Boolean(printer.isDefault),
      status: printer.status
    }));
  });

  ipcMain.handle("pos:print-ticket", async (_event, ticketUrlOrSaleId, options = {}) => {
    try {
      const ticketUrl = normalizeTicketUrl(ticketUrlOrSaleId);
      const printOptions = normalizePrintOptions(options);
      await printTicketWindow(ticketUrl, printOptions);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "No se pudo imprimir el ticket"
      };
    }
  });
}

function normalizePrintOptions(options) {
  const printerName =
    typeof options.printerName === "string" && options.printerName.trim()
      ? options.printerName.trim()
      : undefined;
  const paperSize = allowedPaperSizes.has(options.paperSize)
    ? options.paperSize
    : "TICKET_80";
  const silent = Boolean(options.silent);

  if (silent && !printerName) {
    throw new Error("La impresion silenciosa requiere una impresora seleccionada.");
  }

  return {
    printerName,
    paperSize,
    silent,
    copies: clampInt(options.copies, 1, 5),
    marginMm: clampInt(options.marginMm, 0, 12)
  };
}

function normalizeTicketUrl(ticketUrlOrSaleId) {
  const rawValue = String(ticketUrlOrSaleId ?? "").trim();
  if (!rawValue) {
    throw new Error("Ticket invalido.");
  }

  const appOrigin = getAppOrigin();
  const parsedUrl =
    rawValue.startsWith("http://") || rawValue.startsWith("https://")
      ? new URL(rawValue)
      : rawValue.startsWith("/")
        ? new URL(rawValue, appOrigin)
        : new URL(`/ventas/${encodeURIComponent(rawValue)}/ticket`, appOrigin);

  if (!isAllowedTicketPrintUrl(parsedUrl.toString())) {
    throw new Error("Ruta de ticket no permitida.");
  }

  return parsedUrl.toString();
}

function isAllowedTicketPrintUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return (
      parsedUrl.origin === getAppOrigin() &&
      /^\/ventas\/[^/]+\/ticket$/.test(parsedUrl.pathname)
    );
  } catch {
    return false;
  }
}

function getAppOrigin() {
  return new URL(getStartUrl()).origin;
}

async function printTicketWindow(ticketUrl, printOptions) {
  const printWindow = new BrowserWindow({
    title: "Imprimir ticket",
    width: 420,
    height: 720,
    show: false,
    backgroundColor: "#ffffff",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  printWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  printWindow.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedAppUrl(url)) {
      event.preventDefault();
    }
  });

  try {
    await loadWindow(printWindow, ticketUrl);
    if (!isAllowedTicketPrintUrl(printWindow.webContents.getURL())) {
      throw new Error("No se pudo abrir un ticket autorizado para imprimir.");
    }
    await delay(250);
    for (let copy = 0; copy < printOptions.copies; copy += 1) {
      await printWebContents(printWindow.webContents, printOptions);
    }
  } finally {
    if (!printWindow.isDestroyed()) {
      printWindow.close();
    }
  }
}

function loadWindow(windowToLoad, url) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("No se pudo cargar el ticket para imprimir."));
    }, 20000);

    function cleanup() {
      clearTimeout(timer);
      windowToLoad.webContents.off("did-finish-load", handleLoad);
      windowToLoad.webContents.off("did-fail-load", handleFail);
    }

    function handleLoad() {
      cleanup();
      resolve();
    }

    function handleFail(_event, _errorCode, errorDescription) {
      cleanup();
      reject(new Error(errorDescription || "No se pudo cargar el ticket."));
    }

    windowToLoad.webContents.once("did-finish-load", handleLoad);
    windowToLoad.webContents.once("did-fail-load", handleFail);
    void windowToLoad.loadURL(url);
  });
}

function printWebContents(webContents, printOptions) {
  return new Promise((resolve, reject) => {
    webContents.print(
      {
        silent: printOptions.silent,
        deviceName: printOptions.printerName,
        printBackground: true,
        pageSize: getElectronPageSize(printOptions.paperSize)
      },
      (success, failureReason) => {
        if (success) {
          resolve();
          return;
        }

        reject(new Error(failureReason || "No se pudo imprimir el ticket"));
      }
    );
  });
}

function getElectronPageSize(paperSize) {
  if (paperSize === "A4") {
    return "A4";
  }

  return {
    width: paperSize === "TICKET_58" ? 58000 : 80000,
    height: 210000
  };
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function clampInt(value, min, max) {
  const number = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.min(Math.max(Math.trunc(number), min), max);
}
