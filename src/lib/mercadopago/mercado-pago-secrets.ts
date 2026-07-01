import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ENCRYPTED_PREFIX = "enc:v1:";

export function protectMercadoPagoToken(value: string) {
  const trimmed = value.trim();
  if (!trimmed || isProtectedMercadoPagoToken(trimmed)) {
    return trimmed;
  }

  const secret = getTokenSecret();
  if (!secret) {
    return trimmed;
  }

  const key = createHash("sha256").update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(trimmed, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    ENCRYPTED_PREFIX,
    toBase64Url(iv),
    ".",
    toBase64Url(tag),
    ".",
    toBase64Url(encrypted)
  ].join("");
}

export function revealMercadoPagoToken(value: string) {
  const trimmed = value.trim();
  if (!isProtectedMercadoPagoToken(trimmed)) {
    return trimmed;
  }

  const secret = getTokenSecret();
  if (!secret) {
    throw new Error(
      "Falta TOKEN_ENCRYPTION_SECRET o APP_SECRET para leer credenciales Mercado Pago."
    );
  }

  const payload = trimmed.slice(ENCRYPTED_PREFIX.length);
  const [ivText, tagText, encryptedText] = payload.split(".");
  if (!ivText || !tagText || !encryptedText) {
    throw new Error("El token Mercado Pago guardado no tiene un formato valido.");
  }

  const key = createHash("sha256").update(secret).digest();
  const decipher = createDecipheriv("aes-256-gcm", key, fromBase64Url(ivText));
  decipher.setAuthTag(fromBase64Url(tagText));

  return Buffer.concat([
    decipher.update(fromBase64Url(encryptedText)),
    decipher.final()
  ]).toString("utf8");
}

export function isProtectedMercadoPagoToken(value: string) {
  return value.startsWith(ENCRYPTED_PREFIX);
}

export function canProtectMercadoPagoTokens() {
  return Boolean(getTokenSecret());
}

function getTokenSecret() {
  return (
    process.env.TOKEN_ENCRYPTION_SECRET?.trim() ||
    process.env.APP_SECRET?.trim() ||
    ""
  );
}

function toBase64Url(value: Buffer) {
  return value.toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}
