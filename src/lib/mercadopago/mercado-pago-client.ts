const MERCADO_PAGO_API_BASE = "https://api.mercadopago.com";

export type MercadoPagoRequestDebugInfo = {
  endpoint: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
};

export type MercadoPagoErrorDetails = {
  status: number;
  endpoint: string;
  method: string;
  requestId: string | null;
  request: MercadoPagoRequestDebugInfo;
  error: unknown;
};

export class MercadoPagoApiError extends Error {
  status: number;
  details: MercadoPagoErrorDetails;

  constructor(message: string, details: MercadoPagoErrorDetails) {
    super(message);
    this.name = "MercadoPagoApiError";
    this.status = details.status;
    this.details = details;
  }
}

export async function mercadoPagoRequest<T>({
  accessToken,
  path,
  method = "GET",
  body,
  idempotencyKey,
  query
}: {
  accessToken: string;
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  idempotencyKey?: string;
  query?: Record<string, string | number | boolean | null | undefined>;
}): Promise<T> {
  const url = new URL(path, MERCADO_PAGO_API_BASE);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store"
  });

  const text = await response.text();
  const data = parseJson(text);
  const debugInfo = {
    endpoint: url.toString(),
    method,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {})
    },
    ...(body ? { body: sanitizeMercadoPagoPayload(body) } : {})
  } satisfies MercadoPagoRequestDebugInfo;

  if (!response.ok) {
    const details = {
      status: response.status,
      endpoint: url.toString(),
      method,
      requestId: getRequestId(response),
      request: debugInfo,
      error: sanitizeMercadoPagoPayload(data)
    } satisfies MercadoPagoErrorDetails;
    debugMercadoPago("error", debugInfo, details);

    throw new MercadoPagoApiError(getMercadoPagoErrorMessage(data, response.status), details);
  }

  debugMercadoPago("ok", debugInfo, { status: response.status });
  return data as T;
}

function parseJson(text: string) {
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

function getMercadoPagoErrorMessage(data: unknown, status: number) {
  const code = extractMercadoPagoCode(data).toLowerCase();
  const errorText = JSON.stringify(sanitizeMercadoPagoPayload(data)).toLowerCase();
  if (
    code === "required_properties" &&
    errorText.includes("external_pos_id")
  ) {
    return "Falta external_pos_id. Configura la caja Mercado Pago.";
  }
  if (code === "empty_required_header") {
    return "Falta X-Idempotency-Key en la solicitud a Mercado Pago.";
  }
  if (["unauthorized", "invalid_token", "forbidden"].includes(code) || status === 401) {
    return "Access Token invalido o vencido.";
  }
  if (code === "pos_not_found" || errorText.includes("point of sale not found")) {
    return "La caja Mercado Pago no existe o no pertenece a esta cuenta.";
  }
  if (code === "point_of_sale_exists") {
    return "Ya existe una caja con ese identificador. Podes usarla o elegir otro external_pos_id.";
  }
  if (code === "invalid_external_id") {
    return "El identificador de caja solo puede tener letras y numeros.";
  }
  if (["property_value", "property_type", "bad_request"].includes(code) || status === 400) {
    const detail = getMercadoPagoReadableMessage(data);
    return detail
      ? `Mercado Pago rechazo la orden: ${detail}`
      : "Mercado Pago rechazo algun campo del body. Revisar detalle tecnico.";
  }

  const detail = getMercadoPagoReadableMessage(data);
  if (detail) {
    return `Mercado Pago rechazo la orden: ${detail}`;
  }

  return `Mercado Pago respondio con estado ${status}.`;
}

function getMercadoPagoReadableMessage(data: unknown) {
  if (data && typeof data === "object") {
    const message = "message" in data ? data.message : null;
    const error = "error" in data ? data.error : null;
    const statusDetail = "status_detail" in data ? data.status_detail : null;
    const cause = "cause" in data ? data.cause : "causes" in data ? data.causes : null;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
    if (typeof error === "string" && error.trim()) {
      return error;
    }
    if (typeof statusDetail === "string" && statusDetail.trim()) {
      return statusDetail;
    }

    const causeMessage = getCauseMessage(cause);
    if (causeMessage) {
      return causeMessage;
    }
  }

  return "";
}

function extractMercadoPagoCode(data: unknown) {
  if (!data || typeof data !== "object") {
    return "";
  }

  const error = "error" in data ? data.error : null;
  const message = "message" in data ? data.message : null;
  const statusDetail = "status_detail" in data ? data.status_detail : null;
  const cause = "cause" in data ? data.cause : "causes" in data ? data.causes : null;
  const errors = "errors" in data ? data.errors : null;
  const causeCode = extractCauseCode(cause);
  const errorCode = extractCauseCode(errors);

  return String(causeCode || errorCode || error || statusDetail || message || "");
}

function extractCauseCode(cause: unknown): string {
  if (Array.isArray(cause)) {
    for (const item of cause) {
      const code = extractCauseCode(item);
      if (code) {
        return code;
      }
    }
    return "";
  }

  if (cause && typeof cause === "object") {
    const code = "code" in cause ? cause.code : null;
    const error = "error" in cause ? cause.error : null;
    const message = "message" in cause ? cause.message : null;
    return String(code || error || message || "");
  }

  return "";
}

function getCauseMessage(cause: unknown): string {
  if (Array.isArray(cause)) {
    for (const item of cause) {
      const message = getCauseMessage(item);
      if (message) {
        return message;
      }
    }
    return "";
  }

  if (cause && typeof cause === "object") {
    const message = "message" in cause ? cause.message : null;
    const description = "description" in cause ? cause.description : null;
    const details = "details" in cause ? cause.details : null;
    const code = "code" in cause ? cause.code : null;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
    if (typeof description === "string" && description.trim()) {
      return description;
    }
    if (Array.isArray(details)) {
      const firstDetail = details.find(
        (detail): detail is string => typeof detail === "string" && detail.trim().length > 0
      );
      if (firstDetail) {
        return firstDetail;
      }
    }
    if (typeof code === "string" && code.trim()) {
      return code;
    }
  }

  return "";
}

function getRequestId(response: Response) {
  return (
    response.headers.get("x-request-id") ??
    response.headers.get("x-correlation-id") ??
    response.headers.get("x-meli-trace-site") ??
    null
  );
}

function sanitizeMercadoPagoPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMercadoPagoPayload(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined && entryValue !== null)
      .map(([key, entryValue]) => [
        key,
        isSensitiveKey(key) ? "[redacted]" : sanitizeMercadoPagoPayload(entryValue)
      ])
  );
}

function isSensitiveKey(key: string) {
  return [
    "authorization",
    "access_token",
    "accesstoken",
    "token",
    "refresh_token",
    "refreshtoken"
  ].includes(key.toLowerCase());
}

function debugMercadoPago(
  event: "ok" | "error",
  request: MercadoPagoRequestDebugInfo,
  response: unknown
) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.info("[MercadoPago]", {
    event,
    request,
    response: sanitizeMercadoPagoPayload(response)
  });
}
