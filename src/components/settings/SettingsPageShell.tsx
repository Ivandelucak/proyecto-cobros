"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsTabs } from "./SettingsTabs";

const pageCopy = [
  {
    href: "/configuracion",
    title: "Configuracion",
    description: "Datos basicos del comercio usados por ticket y operacion.",
    exact: true
  },
  {
    href: "/configuracion/pagos",
    title: "Medios de pago",
    description:
      "Configuracion manual para Mercado Pago, transferencia, tarjetas, efectivo y cuenta corriente."
  },
  {
    href: "/configuracion/fiscal",
    title: "Configuracion fiscal",
    description: "Preparacion para ARCA y facturacion electronica futura."
  },
  {
    href: "/configuracion/impresion",
    title: "Impresion",
    description: "Ajustes de tickets, presupuestos y comprobantes."
  },
  {
    href: "/configuracion/mantenimiento",
    title: "Mantenimiento",
    description: "Herramientas de respaldo, limpieza y diagnostico."
  }
];

export function SettingsPageShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const current =
    pageCopy.find((item) =>
      item.exact
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(`${item.href}/`)
    ) ?? pageCopy[0];

  return (
    <section className="space-y-5">
      <PageHeader title={current.title} description={current.description} />
      <SettingsTabs />
      {children}
    </section>
  );
}
