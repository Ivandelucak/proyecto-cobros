import { MercadoPagoEnvironment } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { createMercadoPagoOAuthAuthorizationUrl } from "@/lib/mercadopago/mercado-pago-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const environment = parseEnvironment(url.searchParams.get("environment"));

  try {
    const link = createMercadoPagoOAuthAuthorizationUrl(environment);
    const state = new URL(link.url).searchParams.get("state");
    const response = NextResponse.redirect(link.url);
    if (state) {
      response.cookies.set("mp_oauth_state", state, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 60,
        path: "/api/mercadopago/oauth"
      });
    }
    return response;
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
