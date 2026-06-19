import { mkdir, readFile, readdir, stat, writeFile } from "fs/promises";
import path from "path";
import type { Prisma } from "@prisma/client";
import packageJson from "../../../package.json";
import { prisma } from "@/lib/prisma";

const BACKUP_DIR = path.resolve(process.cwd(), "backups");
const BACKUP_FILENAME_PATTERN =
  /^backup-pos-universal-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}(?:-\d+)?\.(json|sql)$/;

const backupTables = [
  "businessProfiles",
  "printSettings",
  "ticketSettings",
  "cashRegisterSettings",
  "stockSettings",
  "users",
  "paymentMethodSettings",
  "creditInstallmentPlans",
  "categories",
  "products",
  "customers",
  "suppliers",
  "cashSessions",
  "sales",
  "purchases",
  "saleItems",
  "payments",
  "stockMovements",
  "cashMovements",
  "customerAccountMovements",
  "purchaseItems",
  "auditLogs"
] as const;

type BackupTable = (typeof backupTables)[number];

export type BackupFile = {
  name: string;
  createdAt: Date;
  sizeBytes: number;
  type: "JSON" | "SQL";
};

export type BackupPayload = {
  format: "pos-universal-json-backup";
  version: 1;
  generatedAt: string;
  generatedByUserId: string;
  appVersion: string;
  containsPasswordHashes: true;
  data: Record<BackupTable, unknown[]>;
};

type CategoryBackupRow = Prisma.CategoryCreateManyInput & {
  id?: string;
  parentId?: string | null;
};

export async function createJsonBackup(userId: string) {
  await ensureBackupDir();

  const payload = await buildBackupPayload(userId);
  const filename = await createAvailableBackupFilename();
  const filePath = resolveBackupPath(filename);

  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const fileStat = await stat(filePath);
  return {
    name: filename,
    sizeBytes: fileStat.size,
    createdAt: fileStat.birthtime
  };
}

export async function listBackups(): Promise<BackupFile[]> {
  await ensureBackupDir();
  const entries = await readdir(BACKUP_DIR);
  const backups = await Promise.all(
    entries
      .filter((entry) => isValidBackupFilename(entry))
      .map(async (entry) => {
        const filePath = resolveBackupPath(entry);
        const fileStat = await stat(filePath);

        return {
          name: entry,
          createdAt: parseBackupDate(entry) ?? fileStat.birthtime,
          sizeBytes: fileStat.size,
          type: entry.endsWith(".sql") ? "SQL" : "JSON"
        } satisfies BackupFile;
      })
  );

  return backups.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

export async function readBackupForDownload(filename: string) {
  const safeFilename = assertValidBackupFilename(filename);
  const filePath = resolveBackupPath(safeFilename);
  const fileStat = await stat(filePath);
  const content = await readFile(filePath);

  return {
    name: safeFilename,
    content,
    sizeBytes: fileStat.size,
    type: safeFilename.endsWith(".sql") ? "SQL" : "JSON"
  };
}

export async function restoreJsonBackup(filename: string, userId: string) {
  const safeFilename = assertValidBackupFilename(filename);
  if (!safeFilename.endsWith(".json")) {
    throw new Error("Solo se pueden restaurar backups JSON generados por el sistema.");
  }

  const payload = await readJsonBackupPayload(safeFilename);

  await prisma.$transaction(
    async (tx) => {
      await deleteCurrentData(tx);
      await restoreBackupData(tx, payload);

      const restoredUser = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true }
      });
      const restoredUserId = restoredUser?.id ?? null;

      await tx.auditLog.createMany({
        data: [
          {
            userId: restoredUserId,
            action: "BACKUP_RESTORE_ATTEMPT",
            entity: "Maintenance",
            description: `Confirmo restauracion del backup ${safeFilename}.`,
            metadata: { filename: safeFilename }
          },
          {
            userId: restoredUserId,
            action: "BACKUP_RESTORED",
            entity: "Maintenance",
            description: `Restauro el backup ${safeFilename}.`,
            metadata: {
              filename: safeFilename,
              generatedAt: payload.generatedAt,
              appVersion: payload.appVersion
            }
          }
        ]
      });
    },
    { timeout: 30000 }
  );

  return {
    filename: safeFilename,
    generatedAt: payload.generatedAt
  };
}

export function isValidBackupFilename(filename: string) {
  return BACKUP_FILENAME_PATTERN.test(filename);
}

export function assertValidBackupFilename(filename: string) {
  const decodedFilename = decodeURIComponent(filename);
  if (!isValidBackupFilename(decodedFilename)) {
    throw new Error("Nombre de backup invalido.");
  }

  return decodedFilename;
}

export async function getLastBackup() {
  const backups = await listBackups();
  return backups[0] ?? null;
}

function resolveBackupPath(filename: string) {
  const resolvedPath = path.resolve(BACKUP_DIR, filename);
  const safeRoot = `${BACKUP_DIR}${path.sep}`.toLowerCase();
  if (!resolvedPath.toLowerCase().startsWith(safeRoot)) {
    throw new Error("Ruta de backup invalida.");
  }

  return resolvedPath;
}

async function ensureBackupDir() {
  await mkdir(BACKUP_DIR, { recursive: true });
}

async function createAvailableBackupFilename() {
  const stamp = backupDateStamp(new Date());
  const baseName = `backup-pos-universal-${stamp}`;
  let filename = `${baseName}.json`;
  let counter = 2;

  while (await fileExists(resolveBackupPath(filename))) {
    filename = `${baseName}-${counter}.json`;
    counter += 1;
  }

  return filename;
}

async function fileExists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function buildBackupPayload(userId: string): Promise<BackupPayload> {
  const [
    businessProfiles,
    printSettings,
    ticketSettings,
    cashRegisterSettings,
    stockSettings,
    users,
    paymentMethodSettings,
    creditInstallmentPlans,
    categories,
    products,
    customers,
    suppliers,
    cashSessions,
    sales,
    purchases,
    saleItems,
    payments,
    stockMovements,
    cashMovements,
    customerAccountMovements,
    purchaseItems,
    auditLogs
  ] = await Promise.all([
    prisma.businessProfile.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.printSetting.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.ticketSetting.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.cashRegisterSetting.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.stockSetting.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.paymentMethodSetting.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.creditInstallmentPlan.findMany({ orderBy: { installments: "asc" } }),
    prisma.category.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.product.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.customer.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.supplier.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.cashSession.findMany({ orderBy: { openedAt: "asc" } }),
    prisma.sale.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.purchase.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.saleItem.findMany({ orderBy: { id: "asc" } }),
    prisma.payment.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.stockMovement.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.cashMovement.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.customerAccountMovement.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.purchaseItem.findMany({ orderBy: { id: "asc" } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "asc" } })
  ]);

  return {
    format: "pos-universal-json-backup",
    version: 1,
    generatedAt: new Date().toISOString(),
    generatedByUserId: userId,
    appVersion: packageJson.version,
    containsPasswordHashes: true,
    data: {
      businessProfiles,
      printSettings,
      ticketSettings,
      cashRegisterSettings,
      stockSettings,
      users,
      paymentMethodSettings,
      creditInstallmentPlans,
      categories,
      products,
      customers,
      suppliers,
      cashSessions,
      sales,
      purchases,
      saleItems,
      payments,
      stockMovements,
      cashMovements,
      customerAccountMovements,
      purchaseItems,
      auditLogs
    }
  };
}

async function readJsonBackupPayload(filename: string) {
  const content = await readFile(resolveBackupPath(filename), "utf8");
  const payload = JSON.parse(content) as BackupPayload;
  validateBackupPayload(payload);
  return payload;
}

function validateBackupPayload(payload: BackupPayload) {
  if (
    payload.format !== "pos-universal-json-backup" ||
    payload.version !== 1 ||
    !payload.data
  ) {
    throw new Error("El archivo no parece ser un backup valido de POS Universal.");
  }

  for (const table of backupTables) {
    if (!Array.isArray(payload.data[table])) {
      if (isOptionalSettingsTable(table)) {
        payload.data[table] = [];
        continue;
      }
      throw new Error(`El backup no contiene datos validos para ${table}.`);
    }
  }
}

async function deleteCurrentData(tx: Prisma.TransactionClient) {
  await tx.auditLog.deleteMany();
  await tx.customerAccountMovement.deleteMany();
  await tx.stockMovement.deleteMany();
  await tx.payment.deleteMany();
  await tx.saleItem.deleteMany();
  await tx.cashMovement.deleteMany();
  await tx.purchaseItem.deleteMany();
  await tx.sale.deleteMany();
  await tx.purchase.deleteMany();
  await tx.cashSession.deleteMany();
  await tx.product.deleteMany();
  await tx.category.updateMany({ data: { parentId: null } });
  await tx.category.deleteMany();
  await tx.customer.deleteMany();
  await tx.supplier.deleteMany();
  await tx.creditInstallmentPlan.deleteMany();
  await tx.paymentMethodSetting.deleteMany();
  await tx.stockSetting.deleteMany();
  await tx.cashRegisterSetting.deleteMany();
  await tx.ticketSetting.deleteMany();
  await tx.printSetting.deleteMany();
  await tx.businessProfile.deleteMany();
  await tx.user.deleteMany();
}

async function restoreBackupData(tx: Prisma.TransactionClient, payload: BackupPayload) {
  const users = rows<Prisma.UserCreateManyInput>(payload, "users");
  if (users.length > 0) {
    await tx.user.createMany({ data: users });
  }

  const businessProfiles = rows<Prisma.BusinessProfileCreateManyInput>(
    payload,
    "businessProfiles"
  );
  if (businessProfiles.length > 0) {
    await tx.businessProfile.createMany({ data: businessProfiles });
  }

  const printSettings = rows<Prisma.PrintSettingCreateManyInput>(
    payload,
    "printSettings"
  );
  if (printSettings.length > 0) {
    await tx.printSetting.createMany({ data: printSettings });
  }

  const ticketSettings = rows<Prisma.TicketSettingCreateManyInput>(
    payload,
    "ticketSettings"
  );
  if (ticketSettings.length > 0) {
    await tx.ticketSetting.createMany({ data: ticketSettings });
  }

  const cashRegisterSettings = rows<Prisma.CashRegisterSettingCreateManyInput>(
    payload,
    "cashRegisterSettings"
  );
  if (cashRegisterSettings.length > 0) {
    await tx.cashRegisterSetting.createMany({ data: cashRegisterSettings });
  }

  const stockSettings = rows<Prisma.StockSettingCreateManyInput>(
    payload,
    "stockSettings"
  );
  if (stockSettings.length > 0) {
    await tx.stockSetting.createMany({ data: stockSettings });
  }

  const paymentMethodSettings = rows<Prisma.PaymentMethodSettingCreateManyInput>(
    payload,
    "paymentMethodSettings"
  );
  if (paymentMethodSettings.length > 0) {
    await tx.paymentMethodSetting.createMany({ data: paymentMethodSettings });
  }

  const creditPlans = rows<Prisma.CreditInstallmentPlanCreateManyInput>(
    payload,
    "creditInstallmentPlans"
  );
  if (creditPlans.length > 0) {
    await tx.creditInstallmentPlan.createMany({ data: creditPlans });
  }

  const categories = rows<CategoryBackupRow>(payload, "categories");
  if (categories.length > 0) {
    await tx.category.createMany({
      data: categories.map((category) => ({
        ...category,
        parentId: null
      }))
    });
  }
  for (const category of categories) {
    if (category.id && category.parentId) {
      await tx.category.update({
        where: { id: category.id },
        data: { parentId: category.parentId }
      });
    }
  }

  const customers = rows<Prisma.CustomerCreateManyInput>(payload, "customers");
  if (customers.length > 0) {
    await tx.customer.createMany({ data: customers });
  }

  const suppliers = rows<Prisma.SupplierCreateManyInput>(payload, "suppliers");
  if (suppliers.length > 0) {
    await tx.supplier.createMany({ data: suppliers });
  }

  const products = rows<Prisma.ProductCreateManyInput>(payload, "products");
  if (products.length > 0) {
    await tx.product.createMany({ data: products });
  }

  const cashSessions = rows<Prisma.CashSessionCreateManyInput>(
    payload,
    "cashSessions"
  );
  if (cashSessions.length > 0) {
    await tx.cashSession.createMany({ data: cashSessions });
  }

  const sales = rows<Prisma.SaleCreateManyInput>(payload, "sales");
  if (sales.length > 0) {
    await tx.sale.createMany({ data: sales });
  }

  const purchases = rows<Prisma.PurchaseCreateManyInput>(payload, "purchases");
  if (purchases.length > 0) {
    await tx.purchase.createMany({ data: purchases });
  }

  const saleItems = rows<Prisma.SaleItemCreateManyInput>(payload, "saleItems");
  if (saleItems.length > 0) {
    await tx.saleItem.createMany({ data: saleItems });
  }

  const payments = rows<Prisma.PaymentCreateManyInput>(payload, "payments");
  if (payments.length > 0) {
    await tx.payment.createMany({ data: payments });
  }

  const stockMovements = rows<Prisma.StockMovementCreateManyInput>(
    payload,
    "stockMovements"
  );
  if (stockMovements.length > 0) {
    await tx.stockMovement.createMany({ data: stockMovements });
  }

  const cashMovements = rows<Prisma.CashMovementCreateManyInput>(
    payload,
    "cashMovements"
  );
  if (cashMovements.length > 0) {
    await tx.cashMovement.createMany({ data: cashMovements });
  }

  const customerAccountMovements =
    rows<Prisma.CustomerAccountMovementCreateManyInput>(
      payload,
      "customerAccountMovements"
    );
  if (customerAccountMovements.length > 0) {
    await tx.customerAccountMovement.createMany({
      data: customerAccountMovements
    });
  }

  const purchaseItems = rows<Prisma.PurchaseItemCreateManyInput>(
    payload,
    "purchaseItems"
  );
  if (purchaseItems.length > 0) {
    await tx.purchaseItem.createMany({ data: purchaseItems });
  }

  const auditLogs = rows<Prisma.AuditLogCreateManyInput>(payload, "auditLogs");
  if (auditLogs.length > 0) {
    await tx.auditLog.createMany({ data: auditLogs });
  }
}

function rows<T>(payload: BackupPayload, table: BackupTable) {
  return payload.data[table] as T[];
}

function isOptionalSettingsTable(table: BackupTable) {
  return (
    table === "printSettings" ||
    table === "ticketSettings" ||
    table === "cashRegisterSettings" ||
    table === "stockSettings"
  );
}

function backupDateStamp(date: Date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes())
  ].join("-");
}

function parseBackupDate(filename: string) {
  const match = filename.match(
    /^backup-pos-universal-(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})/
  );
  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute)
  );
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
