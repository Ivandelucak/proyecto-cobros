import { MercadoPagoEnvironment } from "@prisma/client";
import { NextResponse } from "next/server";
import { createMercadoPagoOAuthAuthorizationUrl } from "@/lib/mercadopago/mercado-pago-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const environment = parseEnvironment(url.searchParams.get("environment"));

  try {
    const link = createMercadoPagoOAuthAuthorizationUrl(environment);
    return NextResponse.redirect(link.url);
  } catch (error) {
    const redirectUrl = new URL("/configuracion/pagos", request.url);
    redirectUrl.searchParams.set("mp_oauth", "error");
    redirectUrl.searchParams.set(
      "message",
      error instanceof Error
        ? error.message
        : "No se pudo iniciar la conexion Mercado Pago."
    );
    return NextResponse.redirect(redirectUrl);
  }
}

function parseEnvironment(value: string | null) {
  return value === MercadoPagoEnvironment.SANDBOX
    ? MercadoPagoEnvironment.SANDBOX
    : MercadoPagoEnvironment.PRODUCTION;
}
