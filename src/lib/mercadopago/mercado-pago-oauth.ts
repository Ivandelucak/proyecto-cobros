import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  MercadoPagoConnectionType,
  MercadoPagoEnvironment,
  type MercadoPagoAccount
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mercadoPagoRequest } from "./mercado-pago-client";
import {
  protectMercadoPagoToken,
  revealMercadoPagoToken
} from "./mercado-pago-secrets";

const DEFAULT_MERCADO_PAGO_AUTH_URL = "https://auth.mercadopago.com/authorization";
const MERCADO_PAGO_TOKEN_URL = "https://api.mercadopago.com/oauth/token";
const OAUTH_STATE_TTL_MS = 30 * 60 * 1000;
const TOKEN_REFRESH_WINDOW_MS = 10 * 60 * 1000;
const EXPECTED_CALLBACK_PATH = "/api/mercadopago/oauth/callback";
const OAUTH_PLATFORM_ID = "mp";
const OAUTH_RESPONSE_TYPE = "code";

type MercadoPagoOAuthState = {
  nonce: string;
  environment: MercadoPagoEnvironment;
  issuedAt: number;
  businessId?: string;
};

type MercadoPagoOAuthTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  user_id?: string | number;
  public_key?: string;
  live_mode?: boolean;
};

type MercadoPagoUserResponse = {
  id?: string | number;
  nickname?: string;
  email?: string;
};

export type MercadoPagoOAuthLink = {
  url: string;
  environment: MercadoPagoEnvironment;
  expiresAt: string;
};

export type MercadoPagoOAuthConfigStatus = {
  configured: boolean;
  missing: Array<"MP_CLIENT_ID" | "MP_CLIENT_SECRET" | "MP_REDIRECT_URI">;
  clientIdConfigured: boolean;
  clientIdPreview: string | null;
  redirectUri: string | null;
  authBaseUrl: string;
  callbackPath: string;
  platformId: "mp";
  responseType: "code";
  pkceEnabledLocal: boolean;
  openMode: "new_tab";
  stateValidation: "signed_state_with_optional_cookie";
  authorizationUrlPreview: string | null;
  redirectUriWarnings: string[];
  redirectUriExample: string;
  appPublicUrlConfigured: boolean;
  appPublicUrl: string | null;
  redirectBaseUsed: string | null;
  redirectBaseSource: "APP_PUBLIC_URL" | "forwarded_headers" | "request_origin";
  callbackSuccessRedirectPreview: string | null;
  callbackErrorRedirectPreview: string | null;
  message: string;
};

export class MercadoPagoOAuthError extends Error {
  detail: string | null;

  constructor(message: string, detail?: unknown) {
    super(message);
    this.name = "MercadoPagoOAuthError";
    this.detail = detail ? JSON.stringify(sanitizeOAuthPayload(detail), null, 2) : null;
  }
}

export function createMercadoPagoOAuthAuthorizationUrl(
  businessId?: string,
  environment: MercadoPagoEnvironment = MercadoPagoEnvironment.PRODUCTION
): MercadoPagoOAuthLink {
  const config = getMercadoPagoOAuthConfig();
  const state = signMercadoPagoOAuthState({
    nonce: randomBytes(16).toString("hex"),
    environment,
    issuedAt: Date.now(),
    businessId
  });
  const url = new URL(config.authBaseUrl);

  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", OAUTH_RESPONSE_TYPE);
  url.searchParams.set("platform_id", OAUTH_PLATFORM_ID);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);

  return {
    url: url.toString(),
    environment,
    expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString()
  };
}

export async function connectMercadoPagoOAuthAccount(input: {
  code: string;
  state: string;
}): Promise<{ account: MercadoPagoAccount; wasExisting: boolean }> {
  const parsedState = validateMercadoPagoOAuthState(input.state);
  const token = await exchangeMercadoPagoOAuthCode({
    code: input.code
  });

  if (!token.access_token) {
    throw new MercadoPagoOAuthError("Mercado Pago no devolvio access_token.", token);
  }

  const user = await mercadoPagoRequest<MercadoPagoUserResponse>({
    accessToken: token.access_token,
    path: "/users/me"
  });
  const mercadoPagoUserId = String(user.id ?? token.user_id ?? "");
  if (!mercadoPagoUserId) {
    throw new MercadoPagoOAuthError("No se pudo detectar la cuenta Mercado Pago.");
  }

  const protectedAccessToken = protectMercadoPagoToken(token.access_token);
  const protectedRefreshToken = token.refresh_token
    ? protectMercadoPagoToken(token.refresh_token)
    : null;
  const expiresAt = getTokenExpiration(token.expires_in);
  const now = new Date();
  const accountName =
    user.nickname ||
    user.email ||
    `Mercado Pago ${parsedState.environment === "SANDBOX" ? "Sandbox" : "Produccion"}`;

  const existing = await prisma.mercadoPagoAccount.findFirst({
    where: {
      mpUserId: mercadoPagoUserId,
      environment: parsedState.environment,
      businessId: parsedState.businessId || "default",
      deletedAt: null
    }
  });
  const hasDefault = await prisma.mercadoPagoAccount.findFirst({
    where: {
      defaultAccount: true,
      businessId: parsedState.businessId || "default",
      deletedAt: null
    },
    select: { id: true }
  });

  const data = {
    name: accountName,
    enabled: true,
    connectionType: MercadoPagoConnectionType.OAUTH,
    environment: parsedState.environment,
    accessToken: protectedAccessToken,
    oauthRefreshToken: protectedRefreshToken,
    oauthTokenExpiresAt: expiresAt,
    oauthScope: token.scope ?? null,
    oauthConnectedAt: now,
    oauthLastRefreshAt: null,
    oauthRequiresReconnect: false,
    mpUserId: mercadoPagoUserId,
    collectorId: mercadoPagoUserId,
    accountNickname: user.nickname ?? null,
    accountEmail: user.email ?? null,
    publicKey: token.public_key ?? null,
    lastConnectionTestAt: now,
    lastConnectionStatus: "OK",
    lastConnectionMessage: "Cuenta conectada con OAuth Mercado Pago.",
    deletedAt: null
  };

  if (existing) {
    const account = await prisma.mercadoPagoAccount.update({
      where: { id: existing.id },
      data: {
        ...data,
        defaultAccount: existing.defaultAccount || !hasDefault
      }
    });
    return { account, wasExisting: true };
  }

  const account = await prisma.mercadoPagoAccount.create({
    data: {
      ...data,
      businessId: parsedState.businessId || "default",
      defaultAccount: !hasDefault
    }
  });
  return { account, wasExisting: false };
}

export async function refreshMercadoPagoOAuthAccountIfNeeded(
  account: MercadoPagoAccount
): Promise<MercadoPagoAccount> {
  if (
    account.connectionType !== MercadoPagoConnectionType.OAUTH ||
    !account.oauthRefreshToken
  ) {
    return {
      ...account,
      accessToken: revealMercadoPagoToken(account.accessToken)
    };
  }

  const expiresAt = account.oauthTokenExpiresAt?.getTime() ?? 0;
  const shouldRefresh = !expiresAt || expiresAt - Date.now() <= TOKEN_REFRESH_WINDOW_MS;
  if (!shouldRefresh) {
    return {
      ...account,
      accessToken: revealMercadoPagoToken(account.accessToken)
    };
  }

  try {
    const config = getMercadoPagoOAuthConfig();
    const token = await requestMercadoPagoOAuthToken({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: revealMercadoPagoToken(account.oauthRefreshToken)
    });

    if (!token.access_token) {
      throw new MercadoPagoOAuthError("Mercado Pago no devolvio access_token.", token);
    }

    const updated = await prisma.mercadoPagoAccount.update({
      where: { id: account.id },
      data: {
        accessToken: protectMercadoPagoToken(token.access_token),
        oauthRefreshToken: token.refresh_token
          ? protectMercadoPagoToken(token.refresh_token)
          : account.oauthRefreshToken,
        oauthTokenExpiresAt: getTokenExpiration(token.expires_in),
        oauthScope: token.scope ?? account.oauthScope,
        oauthLastRefreshAt: new Date(),
        oauthRequiresReconnect: false,
        lastConnectionStatus: "OK",
        lastConnectionMessage: "Token OAuth renovado automaticamente."
      }
    });

    return {
      ...updated,
      accessToken: revealMercadoPagoToken(updated.accessToken)
    };
  } catch (error) {
    await prisma.mercadoPagoAccount.update({
      where: { id: account.id },
      data: {
        oauthRequiresReconnect: true,
        lastConnectionStatus: "ERROR",
        lastConnectionMessage:
          error instanceof Error ? error.message : "No se pudo renovar OAuth Mercado Pago."
      }
    });
    throw error;
  }
}

export function getMercadoPagoOAuthConfigStatus(): MercadoPagoOAuthConfigStatus {
  const missing: MercadoPagoOAuthConfigStatus["missing"] = [];
  const clientId = process.env.MP_CLIENT_ID?.trim() || "";
  const redirectUri = process.env.MP_REDIRECT_URI?.trim() || "";
  const authBaseUrl = getMercadoPagoAuthBaseUrl();

  if (!clientId) {
    missing.push("MP_CLIENT_ID");
  }
  if (!process.env.MP_CLIENT_SECRET?.trim()) {
    missing.push("MP_CLIENT_SECRET");
  }
  if (!redirectUri) {
    missing.push("MP_REDIRECT_URI");
  }

  const configured = missing.length === 0;
  const appPublicUrl = process.env.APP_PUBLIC_URL?.trim() || "";
  const redirectBaseUsed = appPublicUrl || null;
  const authorizationUrlPreview = clientId && redirectUri
    ? createMercadoPagoOAuthAuthorizationUrlPreview({
        authBaseUrl,
        clientIdPreview: previewSecret(clientId),
        redirectUri
      })
    : null;

  return {
    configured,
    missing,
    clientIdConfigured: Boolean(clientId),
    clientIdPreview: clientId ? previewSecret(clientId) : null,
    redirectUri: redirectUri || null,
    authBaseUrl,
    callbackPath: EXPECTED_CALLBACK_PATH,
    platformId: OAUTH_PLATFORM_ID,
    responseType: OAUTH_RESPONSE_TYPE,
    pkceEnabledLocal: false,
    openMode: "new_tab",
    stateValidation: "signed_state_with_optional_cookie",
    authorizationUrlPreview,
    redirectUriWarnings: [
      ...validateMercadoPagoRedirectUri(redirectUri),
      ...(authBaseUrl.includes("mercadopago.com.ar/authorization")
        ? [
            "authBaseUrl contiene mercadopago.com.ar/authorization. Se recomienda usar: https://auth.mercadopago.com/authorization"
          ]
        : [])
    ],
    redirectUriExample: `https://tu-url-ngrok.ngrok-free.app${EXPECTED_CALLBACK_PATH}`,
    appPublicUrlConfigured: Boolean(appPublicUrl),
    appPublicUrl: appPublicUrl || null,
    redirectBaseUsed,
    redirectBaseSource: appPublicUrl ? "APP_PUBLIC_URL" : "forwarded_headers",
    callbackSuccessRedirectPreview: redirectBaseUsed
      ? createCallbackRedirectPreview(redirectBaseUsed, "success")
      : null,
    callbackErrorRedirectPreview: redirectBaseUsed
      ? createCallbackRedirectPreview(redirectBaseUsed, "error")
      : null,
    message: configured
      ? "OAuth configurado."
      : "Falta configurar OAuth de Mercado Pago en el servidor. Completa MP_CLIENT_ID, MP_CLIENT_SECRET y MP_REDIRECT_URI."
  };
}

function getMercadoPagoOAuthConfig() {
  const clientId = process.env.MP_CLIENT_ID?.trim();
  const clientSecret = process.env.MP_CLIENT_SECRET?.trim();
  const redirectUri = process.env.MP_REDIRECT_URI?.trim();

  if (!clientId || !clientSecret || !redirectUri) {
    throw new MercadoPagoOAuthError(getMercadoPagoOAuthConfigStatus().message);
  }

  return { clientId, clientSecret, redirectUri, authBaseUrl: getMercadoPagoAuthBaseUrl() };
}

async function exchangeMercadoPagoOAuthCode(input: { code: string }) {
  const config = getMercadoPagoOAuthConfig();

  return requestMercadoPagoOAuthToken({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code: input.code,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri
  });
}

async function requestMercadoPagoOAuthToken(
  body: Record<string, string | boolean>
): Promise<MercadoPagoOAuthTokenResponse> {
  const formBody = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    formBody.set(key, String(value));
  }

  const response = await fetch(MERCADO_PAGO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body: formBody.toString(),
    cache: "no-store"
  });
  const text = await response.text();
  const data = parseOAuthJson(text);

  if (!response.ok) {
    throw new MercadoPagoOAuthError(getOAuthErrorMessage(data), data);
  }

  return data as MercadoPagoOAuthTokenResponse;
}

function signMercadoPagoOAuthState(state: MercadoPagoOAuthState) {
  const payload = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  const signature = createHmac("sha256", getOAuthStateSecret())
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

function validateMercadoPagoOAuthState(value: string): MercadoPagoOAuthState {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) {
    throw new MercadoPagoOAuthError("El estado OAuth de Mercado Pago es invalido.");
  }

  const expectedSignature = createHmac("sha256", getOAuthStateSecret())
    .update(payload)
    .digest("base64url");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new MercadoPagoOAuthError("El estado OAuth de Mercado Pago no coincide.");
  }

  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<
    MercadoPagoOAuthState
  >;
  const environment = parsed.environment;
  if (
    environment !== MercadoPagoEnvironment.SANDBOX &&
    environment !== MercadoPagoEnvironment.PRODUCTION
  ) {
    throw new MercadoPagoOAuthError("El entorno OAuth de Mercado Pago es invalido.");
  }
  if (!parsed.issuedAt || Date.now() - parsed.issuedAt > OAUTH_STATE_TTL_MS) {
    throw new MercadoPagoOAuthError("El enlace de conexion Mercado Pago vencio.");
  }

  return {
    nonce: String(parsed.nonce ?? ""),
    environment,
    issuedAt: parsed.issuedAt || Date.now(),
    businessId: parsed.businessId ? String(parsed.businessId) : undefined
  };
}

function getMercadoPagoAuthBaseUrl() {
  return (
    process.env.MP_AUTH_BASE_URL?.trim() ||
    process.env.MP_OAUTH_AUTH_BASE_URL?.trim() ||
    DEFAULT_MERCADO_PAGO_AUTH_URL
  );
}

function createMercadoPagoOAuthAuthorizationUrlPreview(input: {
  authBaseUrl: string;
  clientIdPreview: string;
  redirectUri: string;
}) {
  const url = new URL(input.authBaseUrl);
  url.searchParams.set("client_id", input.clientIdPreview);
  url.searchParams.set("response_type", OAUTH_RESPONSE_TYPE);
  url.searchParams.set("platform_id", OAUTH_PLATFORM_ID);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", "<STATE>");

  return url.toString();
}

function createCallbackRedirectPreview(baseUrl: string, status: "success" | "error") {
  const url = new URL("/configuracion/pagos", baseUrl);
  url.searchParams.set("mp_oauth", status);
  url.searchParams.set("message", status === "success" ? "<SUCCESS_MESSAGE>" : "<ERROR_MESSAGE>");
  return url.toString();
}

function validateMercadoPagoRedirectUri(value: string) {
  if (!value) {
    return [];
  }

  const warnings: string[] = [];

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      warnings.push("MP_REDIRECT_URI no empieza con https://. Mercado Pago puede rechazar la autorizacion.");
    }
    if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
      warnings.push("MP_REDIRECT_URI contiene localhost. Para OAuth real usa una URL publica HTTPS como ngrok.");
    }
    if (url.search) {
      warnings.push("MP_REDIRECT_URI tiene query params.");
    }
    if (!url.pathname.endsWith(EXPECTED_CALLBACK_PATH)) {
      warnings.push(
        `MP_REDIRECT_URI debe terminar en ${EXPECTED_CALLBACK_PATH}.`
      );
    }
  } catch {
    warnings.push("MP_REDIRECT_URI no es una URL valida.");
  }

  return warnings;
}

function previewSecret(value: string) {
  if (value.length <= 8) {
    return `${value.slice(0, 2)}...${value.slice(-2)}`;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function getOAuthStateSecret() {
  const secret =
    process.env.APP_SECRET?.trim() ||
    process.env.TOKEN_ENCRYPTION_SECRET?.trim() ||
    process.env.MP_CLIENT_SECRET?.trim();

  if (!secret) {
    throw new MercadoPagoOAuthError(
      "Falta APP_SECRET o TOKEN_ENCRYPTION_SECRET para firmar la conexion Mercado Pago."
    );
  }

  return secret;
}

function getTokenExpiration(expiresInSeconds: number | undefined) {
  if (!expiresInSeconds || expiresInSeconds <= 0) {
    return null;
  }

  return new Date(Date.now() + expiresInSeconds * 1000);
}

function parseOAuthJson(text: string) {
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

function getOAuthErrorMessage(data: unknown) {
  if (data && typeof data === "object") {
    const message = "message" in data ? data.message : null;
    const error = "error" in data ? data.error : null;
    if (typeof message === "string" && message.trim()) {
      return `Mercado Pago rechazo OAuth: ${message}`;
    }
    if (typeof error === "string" && error.trim()) {
      return `Mercado Pago rechazo OAuth: ${error}`;
    }
  }

  return "Mercado Pago rechazo la conexion OAuth.";
}

function sanitizeOAuthPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeOAuthPayload(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [
      key,
      key.toLowerCase().includes("token") || key.toLowerCase().includes("secret")
        ? "[redacted]"
        : sanitizeOAuthPayload(entryValue)
    ])
  );
}
