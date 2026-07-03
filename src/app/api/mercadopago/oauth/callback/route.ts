import { NextRequest, NextResponse } from "next/server";
import { connectMercadoPagoOAuthAccount } from "@/lib/mercadopago/mercado-pago-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const redirectTarget = createOAuthReturnUrl(request);
  const redirectUrl = redirectTarget.url;
  redirectUrl.searchParams.set("redirect_base_source", redirectTarget.source);

  if (error) {
    redirectUrl.searchParams.set("mp_oauth", "error");
    redirectUrl.searchParams.set(
      "message",
      errorDescription || "Mercado Pago cancelo o rechazo la autorizacion."
    );
    return redirectAndClearState(redirectUrl);
  }

  if (!code || !state) {
    redirectUrl.searchParams.set("mp_oauth", "error");
    redirectUrl.searchParams.set(
      "message",
      "Mercado Pago no devolvio codigo de autorizacion."
    );
    return redirectAndClearState(redirectUrl);
  }

  const cookieState = request.cookies.get("mp_oauth_state")?.value;
  if (cookieState && cookieState !== state) {
    redirectUrl.searchParams.set("mp_oauth", "error");
    redirectUrl.searchParams.set(
      "message",
      "El estado OAuth de Mercado Pago no coincide."
    );
    return redirectAndClearState(redirectUrl);
  }

  try {
    const result = await connectMercadoPagoOAuthAccount({ code, state });
    redirectUrl.searchParams.set("mp_oauth", "success");
    redirectUrl.searchParams.set(
      "message",
      result.wasExisting
        ? "La cuenta ya estaba conectada. Se actualizo la conexion. Podes cerrar esta pestana o volver a Fox Point en la computadora."
        : "Mercado Pago vinculado correctamente. Podes cerrar esta pestana o volver a Fox Point en la computadora."
    );
    return redirectAndClearState(redirectUrl);
  } catch (cause) {
    redirectUrl.searchParams.set("mp_oauth", "error");
    redirectUrl.searchParams.set(
      "message",
      cause instanceof Error
        ? cause.message
        : "No se pudo completar la conexion Mercado Pago."
    );
    return redirectAndClearState(redirectUrl);
  }
}

function redirectAndClearState(url: URL) {
  const response = NextResponse.redirect(url);
  response.cookies.set("mp_oauth_state", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/api/mercadopago/oauth"
  });
  return response;
}

function createOAuthReturnUrl(request: NextRequest) {
  const resolved = resolvePublicBaseUrl(request);
  return {
    url: new URL("/configuracion/pagos", resolved.baseUrl),
    source: resolved.source
  };
}

function resolvePublicBaseUrl(request: NextRequest) {
  const configuredUrl = process.env.APP_PUBLIC_URL?.trim();
  if (configuredUrl) {
    return { baseUrl: normalizeBaseUrl(configuredUrl), source: "APP_PUBLIC_URL" as const };
  }

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwardedProto && forwardedHost) {
    return {
      baseUrl: `${forwardedProto}://${forwardedHost}`,
      source: "forwarded_headers" as const
    };
  }

  return {
    baseUrl: request.nextUrl.origin,
    source: "request_origin" as const
  };
}

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
