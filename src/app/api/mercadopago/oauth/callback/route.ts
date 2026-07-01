import { NextResponse } from "next/server";
import { connectMercadoPagoOAuthAccount } from "@/lib/mercadopago/mercado-pago-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const redirectUrl = new URL("/configuracion/pagos", request.url);

  if (error) {
    redirectUrl.searchParams.set("mp_oauth", "error");
    redirectUrl.searchParams.set(
      "message",
      errorDescription || "Mercado Pago cancelo o rechazo la autorizacion."
    );
    return NextResponse.redirect(redirectUrl);
  }

  if (!code || !state) {
    redirectUrl.searchParams.set("mp_oauth", "error");
    redirectUrl.searchParams.set(
      "message",
      "Mercado Pago no devolvio codigo de autorizacion."
    );
    return NextResponse.redirect(redirectUrl);
  }

  try {
    await connectMercadoPagoOAuthAccount({ code, state });
    redirectUrl.searchParams.set("mp_oauth", "connected");
    return NextResponse.redirect(redirectUrl);
  } catch (cause) {
    redirectUrl.searchParams.set("mp_oauth", "error");
    redirectUrl.searchParams.set(
      "message",
      cause instanceof Error
        ? cause.message
        : "No se pudo completar la conexion Mercado Pago."
    );
    return NextResponse.redirect(redirectUrl);
  }
}
