import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { requireAdminPage } from "@/lib/admin-auth";
import type { BackupFile } from "@/lib/maintenance/backups";
import { listBackups } from "@/lib/maintenance/backups";
import type { HealthStatus, SystemHealthCheck } from "@/lib/maintenance/health";
import { getSystemHealth } from "@/lib/maintenance/health";
import { createBackupAction, restoreBackupAction } from "./actions";

export const dynamic = "force-dynamic";

type MantenimientoPageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
};

export default async function MantenimientoPage({
  searchParams
}: MantenimientoPageProps) {
  await requireAdminPage();

  const params = await searchParams;
  const [backups, health] = await Promise.all([listBackups(), getSystemHealth()]);
  const from = dateInput(daysAgo(30));
  const to = dateInput(new Date());

  return (
    <div className="space-y-5">
      {params.success ? (
        <Alert tone="success" message={params.success} />
      ) : null}
      {params.error ? <Alert tone="error" message={params.error} /> : null}

      <section className="space-y-3">
        <SectionTitle
          title="Estado del sistema"
          description="Chequeos rapidos de base, configuracion, caja, stock y backups."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Version" value={health.appVersion} />
          <Metric label="Productos activos" value={String(health.productCount)} />
          <Metric label="Ventas registradas" value={String(health.saleCount)} />
          <Metric label="Usuarios activos" value={String(health.activeUserCount)} />
        </div>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-[#273342] dark:bg-[#121922] dark:text-[#7F8D9A]">
                <tr>
                  <th className="px-4 py-3 font-medium">Control</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                {health.checks.map((check) => (
                  <HealthRow key={check.label} check={check} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="p-5">
          <SectionTitle
            title="Backup manual"
            description="Crea un archivo JSON local con los datos criticos del sistema."
          />
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
            Los backups son sensibles: incluyen datos operativos y hashes de usuarios.
            Guardalos en un lugar seguro.
          </div>
          <form action={createBackupAction} className="mt-4">
            <Button type="submit" variant="primary">
              Crear backup ahora
            </Button>
          </form>
          <p className="mt-4 text-sm text-gray-500 dark:text-[#7F8D9A]">
            Ultimo backup:{" "}
            <span className="font-medium text-gray-800 dark:text-[#F3F7FA]">
              {health.lastBackupAt ? formatDateTime(health.lastBackupAt) : "sin backups"}
            </span>
          </p>
        </Card>

        <Card className="p-5">
          <SectionTitle
            title="Exportacion de datos"
            description="Descargas puntuales para revisar o guardar informacion critica."
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <LinkButton href="/configuracion/mantenimiento/exportaciones/productos">
              Exportar productos
            </LinkButton>
            <LinkButton href="/configuracion/mantenimiento/exportaciones/clientes-saldo">
              Exportar clientes
            </LinkButton>
            <LinkButton href="/configuracion/mantenimiento/exportaciones/stock">
              Exportar stock
            </LinkButton>
          </div>
          <form
            action="/configuracion/mantenimiento/exportaciones/ventas"
            method="get"
            className="mt-4 grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-[#273342] sm:grid-cols-[1fr_1fr_auto]"
          >
            <Input name="from" type="date" defaultValue={from} aria-label="Desde" />
            <Input name="to" type="date" defaultValue={to} aria-label="Hasta" />
            <Button type="submit" variant="secondary">
              Exportar ventas
            </Button>
          </form>
        </Card>
      </div>

      <section className="space-y-3">
        <SectionTitle
          title="Backups disponibles"
          description="Archivos generados por el sistema dentro de la carpeta local de backups."
        />
        {backups.length === 0 ? (
          <EmptyState
            title="Sin backups"
            description="Crea el primer backup manual para que aparezca en este listado."
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-[#273342] dark:bg-[#121922] dark:text-[#7F8D9A]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Archivo</th>
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Tamano</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium">Descarga</th>
                    <th className="px-4 py-3 font-medium">Restauracion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                  {backups.map((backup) => (
                    <BackupRow key={backup.name} backup={backup} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>

      <Card className="border-red-200 bg-red-50/60 p-5 dark:border-red-900/70 dark:bg-red-950/20">
        <SectionTitle
          title="Restauracion"
          description="Restaurar un backup puede reemplazar datos actuales. Esta accion es delicada."
        />
        <p className="mt-3 text-sm leading-6 text-red-800 dark:text-red-100">
          Para restaurar, elegi un backup JSON del listado y escribi RESTAURAR en
          mayusculas. La operacion se ejecuta en una transaccion y solo acepta
          archivos generados por el sistema.
        </p>
      </Card>
    </div>
  );
}

function BackupRow({ backup }: { backup: BackupFile }) {
  const downloadHref = `/configuracion/mantenimiento/backups/${encodeURIComponent(
    backup.name
  )}`;

  return (
    <tr className="align-middle hover:bg-slate-50 dark:hover:bg-neutral-800/60">
      <td className="px-4 py-3 font-medium text-gray-950 dark:text-[#F3F7FA]">
        {backup.name}
      </td>
      <td className="px-4 py-3 text-gray-700 dark:text-[#A9B6C2]">
        {formatDateTime(backup.createdAt)}
      </td>
      <td className="px-4 py-3 text-gray-700 dark:text-[#A9B6C2]">
        {formatBytes(backup.sizeBytes)}
      </td>
      <td className="px-4 py-3">
        <Badge tone={backup.type === "JSON" ? "blue" : "gray"}>{backup.type}</Badge>
      </td>
      <td className="px-4 py-3">
        <LinkButton href={downloadHref} size="sm">
          Descargar
        </LinkButton>
      </td>
      <td className="px-4 py-3">
        {backup.type === "JSON" ? (
          <form
            action={restoreBackupAction}
            className="grid gap-2 md:grid-cols-[150px_auto]"
          >
            <input type="hidden" name="filename" value={backup.name} />
            <Input
              name="confirmation"
              placeholder="RESTAURAR"
              className="h-9"
              autoComplete="off"
            />
            <Button type="submit" variant="danger" size="sm">
              Restaurar
            </Button>
          </form>
        ) : (
          <Button type="button" variant="danger" size="sm" disabled>
            Restaurar
          </Button>
        )}
      </td>
    </tr>
  );
}

function HealthRow({ check }: { check: SystemHealthCheck }) {
  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-neutral-800/60">
      <td className="px-4 py-3 font-medium text-gray-950 dark:text-[#F3F7FA]">
        {check.label}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={check.status} />
      </td>
      <td className="px-4 py-3 text-gray-700 dark:text-[#A9B6C2]">{check.detail}</td>
    </tr>
  );
}

function StatusBadge({ status }: { status: HealthStatus }) {
  const tone =
    status === "OK" ? "green" : status === "Atencion" ? "amber" : "red";

  return <Badge tone={tone}>{status}</Badge>;
}

function Alert({ tone, message }: { tone: "success" | "error"; message: string }) {
  return (
    <div
      className={
        tone === "success"
          ? "rounded-lg border border-[#BFE3D2] bg-[#E8F6EF] px-4 py-3 text-sm text-[#1F8F63] dark:border-[#28A36A]/55 dark:bg-[#28A36A]/14 dark:text-[#D4F2E1]"
          : "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-100"
      }
    >
      {message}
    </div>
  );
}

function SectionTitle({
  title,
  description
}: {
  title: string;
  description?: string;
}) {
  return (
    <div>
      <h2 className="text-base font-semibold text-gray-950 dark:text-[#F3F7FA]">
        {title}
      </h2>
      {description ? (
        <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-[#A9B6C2]">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-sm font-medium text-gray-500 dark:text-[#7F8D9A]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-950 dark:text-[#F3F7FA]">
        {value}
      </p>
    </Card>
  );
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
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

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}
