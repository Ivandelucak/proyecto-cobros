import { Role } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit-log";
import { readBackupForDownload } from "@/lib/maintenance/backups";

export const dynamic = "force-dynamic";

type BackupDownloadRouteProps = {
  params: Promise<{ filename: string }>;
};

export async function GET(_request: Request, { params }: BackupDownloadRouteProps) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("No autorizado.", { status: 401 });
  }
  if (user.role !== Role.ADMIN) {
    return new Response("No autorizado.", { status: 403 });
  }

  try {
    const { filename } = await params;
    const backup = await readBackupForDownload(filename);

    await createAuditLog({
      userId: user.id,
      action: "BACKUP_DOWNLOADED",
      entity: "Maintenance",
      description: `Descargo el backup ${backup.name}.`,
      metadata: {
        filename: backup.name,
        type: backup.type,
        sizeBytes: backup.sizeBytes
      }
    });

    return new Response(new Uint8Array(backup.content), {
      headers: {
        "Content-Type": backup.type === "JSON" ? "application/json" : "application/sql",
        "Content-Disposition": `attachment; filename="${backup.name}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : "No se pudo descargar el backup.",
      { status: 400 }
    );
  }
}
