export class ArcaError extends Error {
  constructor(
    message: string,
    readonly details?: string
  ) {
    super(message);
    this.name = "ArcaError";
  }
}

export function toArcaError(error: unknown, fallback: string) {
  if (error instanceof ArcaError) {
    return error;
  }

  if (error instanceof Error) {
    return new ArcaError(fallback, error.message);
  }

  return new ArcaError(fallback);
}

export function sanitizeArcaDetail(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value
    .replace(/<(?:[\w-]+:)?token\b[^>]*>[\s\S]*?<\/(?:[\w-]+:)?token>/gi, "<token>[oculto]</token>")
    .replace(/<(?:[\w-]+:)?sign\b[^>]*>[\s\S]*?<\/(?:[\w-]+:)?sign>/gi, "<sign>[oculto]</sign>")
    .replace(/<(?:[\w-]+:)?in0\b[^>]*>[\s\S]*?<\/(?:[\w-]+:)?in0>/gi, "<in0>[CMS oculto]</in0>")
    .replace(/-----BEGIN [\s\S]*?-----END [^-]+-----/g, "[PEM oculto]")
    .slice(0, 2000);
}

export type NormalizedFiscalError = {
  userMessage: string;
  technicalMessage: string;
  errorCode?: string | null;
  rawResponse?: string | null;
};

export function normalizeFiscalError(error: unknown): NormalizedFiscalError {
  let userMessage = "Error desconocido al procesar el comprobante fiscal.";
  let technicalMessage = "";
  let errorCode: string | null = null;
  let rawResponse: string | null = null;

  if (error instanceof ArcaError) {
    userMessage = error.message;
    technicalMessage = error.details ?? error.message;
    // Intentar extraer código del mensaje (ej: [123] Mensaje)
    const match = error.message.match(/^\[(\d+)\]/);
    if (match) {
      errorCode = match[1];
    }
  } else if (error instanceof Error) {
    userMessage = error.message;
    technicalMessage = error.stack ?? error.message;
  } else if (typeof error === "string") {
    userMessage = error;
    technicalMessage = error;
  } else if (error && typeof error === "object") {
    technicalMessage = JSON.stringify(error);
    const errObj = error as any;
    userMessage = errObj.message || errObj.faultstring || errObj.reason || "Error de objeto en el procesamiento fiscal.";
    if (errObj.code) {
      errorCode = String(errObj.code);
    }
    if (errObj.response || errObj.body) {
      rawResponse = typeof errObj.response === "string" ? errObj.response : JSON.stringify(errObj.response || errObj.body);
    }
  } else {
    technicalMessage = String(error);
    userMessage = String(error);
  }

  if (
    userMessage.includes("10246") ||
    technicalMessage.includes("10246") ||
    errorCode === "10246"
  ) {
    userMessage = "Falta informar la condición frente al IVA del receptor. Para consumidor final se debe enviar código 5.";
  }


  // Si userMessage tiene etiquetas XML o HTML, removerlas para no enturbiar la UI
  if (userMessage.includes("<") && userMessage.includes(">")) {
    userMessage = userMessage.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  // Quitar stack traces o líneas adicionales si están en el message
  if (userMessage.includes("at ") || userMessage.includes("\n")) {
    userMessage = userMessage.split("\n")[0].trim();
  }

  // Quitar rutas locales sensibles del mensaje del usuario final
  userMessage = userMessage.replace(/[a-zA-Z]:\\[\\\w-._\s]+(?:\.js|\.ts|\.tsx)?/g, "[ruta_interna]");
  userMessage = userMessage.replace(/\/[\w-._\s]+\/(?:\.js|\.ts|\.tsx)?/g, "[ruta_interna]");
  userMessage = userMessage.replace(/\.next\/server\/chunks\/[\w-._\s]+/g, "[chunk_interno]");

  // Truncar estrictamente para evitar desbordar campos cortos de base de datos
  const maxUserLength = 400; // límite seguro bajo 500
  if (userMessage.length > maxUserLength) {
    userMessage = userMessage.slice(0, maxUserLength) + "...";
  }

  if (!userMessage.trim()) {
    userMessage = "Error técnico al procesar el comprobante fiscal.";
  }

  return {
    userMessage,
    technicalMessage: sanitizeTechnicalError(technicalMessage),
    errorCode,
    rawResponse
  };
}

export function sanitizeTechnicalError(value: string | null | undefined): string {
  if (!value) return "";
  let sanitized = value;

  // Ocultar certificados, firmas, tokens, etc.
  sanitized = sanitized.replace(/<(?:[\w-]+:)?token\b[^>]*>[\s\S]*?<\/(?:[\w-]+:)?token>/gi, "<token>[oculto]</token>");
  sanitized = sanitized.replace(/<(?:[\w-]+:)?sign\b[^>]*>[\s\S]*?<\/(?:[\w-]+:)?sign>/gi, "<sign>[oculto]</sign>");
  sanitized = sanitized.replace(/<(?:[\w-]+:)?in0\b[^>]*>[\s\S]*?<\/(?:[\w-]+:)?in0>/gi, "<in0>[CMS oculto]</in0>");
  sanitized = sanitized.replace(/-----BEGIN [\s\S]*?-----END [^-]+-----/g, "[PEM oculto]");

  // Ocultar rutas de archivos del servidor
  sanitized = sanitized.replace(/[a-zA-Z]:\\[\\\w-._\s]+(?:\.js|\.ts|\.tsx)?/g, "[ruta_interna]");
  sanitized = sanitized.replace(/\/[\w-._\s]+\/(?:\.js|\.ts|\.tsx)?/g, "[ruta_interna]");
  sanitized = sanitized.replace(/\.next\/server\/chunks\/[\w-._\s]+/g, "[chunk_interno]");

  // Ocultar líneas de stack trace (líneas que empiezan con at o async)
  sanitized = sanitized
    .split("\n")
    .filter(line => !line.trim().startsWith("at ") && !line.trim().startsWith("async "))
    .join("\n")
    .trim();

  return sanitized.slice(0, 1000);
}
