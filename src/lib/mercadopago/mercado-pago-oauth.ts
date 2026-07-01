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

const MERCADO_PAGO_AUTH_URL = "https://auth.mercadopago.com/authorization";
const MERCADO_PAGO_TOKEN_URL = "https://api.mercadopago.com/oauth/token";
const OAUTH_STATE_TTL_MS = 30 * 60 * 1000;
const TOKEN_REFRESH_WINDOW_MS = 10 * 60 * 1000;

type MercadoPagoOAuthState = {
  nonce: string;
  environment: MercadoPagoEnvironment;
  issuedAt: number;
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

export class MercadoPagoOAuthError extends Error {
  detail: string | null;

  constructor(message: string, detail?: unknown) {
    super(message);
    this.name = "MercadoPagoOAuthError";
    this.detail = detail ? JSON.stringify(sanitizeOAuthPayload(detail), null, 2) : null;
  }
}

export function createMercadoPagoOAuthAuthorizationUrl(
  environment: MercadoPagoEnvironment = MercadoPagoEnvironment.PRODUCTION
): MercadoPagoOAuthLink {
  const config = getMercadoPagoOAuthConfig();
  const state = signMercadoPagoOAuthState({
    nonce: randomBytes(16).toString("hex"),
    environment,
    issuedAt: Date.now()
  });
  const url = new URL(MERCADO_PAGO_AUTH_URL);

  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", config.redirectUri);

  return {
    url: url.toString(),
    environment,
    expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString()
  };
}

export async function connectMercadoPagoOAuthAccount(input: {
  code: string;
  state: string;
}) {
  const parsedState = validateMercadoPagoOAuthState(input.state);
  const token = await exchangeMercadoPagoOAuthCode({
    code: input.code,
    environment: parsedState.environment
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
      deletedAt: null
    }
  });
  const hasDefault = await prisma.mercadoPagoAccount.findFirst({
    where: { defaultAccount: true, deletedAt: null },
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
    return prisma.mercadoPagoAccount.update({
      where: { id: existing.id },
      data: {
        ...data,
        defaultAccount: existing.defaultAccount || !hasDefault
      }
    });
  }

  return prisma.mercadoPagoAccount.create({
    data: {
      ...data,
      defaultAccount: !hasDefault
    }
  });
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

function getMercadoPagoOAuthConfig() {
  const clientId = process.env.MP_CLIENT_ID?.trim();
  const clientSecret = process.env.MP_CLIENT_SECRET?.trim();
  const redirectUri = process.env.MP_REDIRECT_URI?.trim();

  if (!clientId || !clientSecret || !redirectUri) {
    throw new MercadoPagoOAuthError(
      "Faltan MP_CLIENT_ID, MP_CLIENT_SECRET o MP_REDIRECT_URI para conectar Mercado Pago."
    );
  }

  return { clientId, clientSecret, redirectUri };
}

async function exchangeMercadoPagoOAuthCode(input: {
  code: string;
  environment: MercadoPagoEnvironment;
}) {
  const config = getMercadoPagoOAuthConfig();

  return requestMercadoPagoOAuthToken({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code: input.code,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
    test_token: input.environment === MercadoPagoEnvironment.SANDBOX
  });
}

async function requestMercadoPagoOAuthToken(
  body: Record<string, string | boolean>
): Promise<MercadoPagoOAuthTokenResponse> {
  const response = await fetch(MERCADO_PAGO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(body),
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
    issuedAt: parsed.issuedAt
  };
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
