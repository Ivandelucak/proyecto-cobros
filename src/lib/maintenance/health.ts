import { CashSessionStatus } from "@prisma/client";
import packageJson from "../../../package.json";
import { getLastBackup } from "@/lib/maintenance/backups";
import { prisma } from "@/lib/prisma";

export type HealthStatus = "OK" | "Atencion" | "Error";

export type SystemHealthCheck = {
  label: string;
  status: HealthStatus;
  detail: string;
};

export type SystemHealth = {
  appVersion: string;
  productCount: number;
  saleCount: number;
  activeUserCount: number;
  hasBusinessProfile: boolean;
  hasOpenCashSession: boolean;
  lowStockCount: number;
  lastBackupAt: Date | null;
  checks: SystemHealthCheck[];
};

export async function getSystemHealth(): Promise<SystemHealth> {
  let dbConnected = true;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbConnected = false;
  }

  const [
    productCount,
    saleCount,
    activeUserCount,
    businessProfile,
    openCashSession,
    lowStockCount,
    lastBackup
  ] = dbConnected
    ? await Promise.all([
        prisma.product.count({ where: { active: true, deletedAt: null } }),
        prisma.sale.count(),
        prisma.user.count({ where: { active: true } }),
        prisma.businessProfile.findUnique({ where: { id: "default" } }),
        prisma.cashSession.findFirst({
          where: { status: CashSessionStatus.OPEN },
          select: { id: true }
        }),
        prisma.product.count({
          where: {
            active: true,
            deletedAt: null,
            stock: { lte: prisma.product.fields.minStock }
          }
        }),
        getLastBackup()
      ])
    : [0, 0, 0, null, null, 0, null];

  const lastBackupAt = lastBackup?.createdAt ?? null;
  const backupStatus = getBackupStatus(lastBackupAt);

  return {
    appVersion: packageJson.version,
    productCount,
    saleCount,
    activeUserCount,
    hasBusinessProfile: Boolean(businessProfile),
    hasOpenCashSession: Boolean(openCashSession),
    lowStockCount,
    lastBackupAt,
    checks: [
      {
        label: "Base de datos conectada",
        status: dbConnected ? "OK" : "Error",
        detail: dbConnected ? "Conexion activa." : "No se pudo consultar la base."
      },
      {
        label: "Configuracion del comercio",
        status: businessProfile ? "OK" : "Atencion",
        detail: businessProfile ? "Perfil cargado." : "Falta cargar el perfil del comercio."
      },
      {
        label: "Backup reciente",
        status: backupStatus,
        detail: lastBackupAt
          ? `Ultimo backup: ${formatDateTime(lastBackupAt)}.`
          : "Todavia no hay backups creados."
      },
      {
        label: "Stock bajo",
        status: lowStockCount > 0 ? "Atencion" : "OK",
        detail:
          lowStockCount > 0
            ? `${lowStockCount} producto(s) por debajo del minimo.`
            : "No hay productos con stock bajo."
      },
      {
        label: "Caja",
        status: "OK",
        detail: openCashSession ? "Hay una caja abierta." : "No hay caja abierta."
      }
    ]
  };
}

function getBackupStatus(lastBackupAt: Date | null): HealthStatus {
  if (!lastBackupAt) {
    return "Atencion";
  }

  const daysSinceBackup =
    (Date.now() - lastBackupAt.getTime()) / (1000 * 60 * 60 * 24);

  return daysSinceBackup > 7 ? "Atencion" : "OK";
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
