import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { ArcaError } from "@/lib/fiscal/arca/arca-errors";

const PREFIX = "arca-provider:v1:";

export function assertProviderTokenEncryptionReady() {
  getEncryptionKey();
}

export function encryptProviderToken(value: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptProviderToken(value: string): string {
  if (!value.startsWith(PREFIX)) {
    throw new ArcaError("No se pudo acceder al cache seguro del prestador.");
  }

  const [ivText, tagText, encryptedText] = value.slice(PREFIX.length).split(".");
  if (!ivText || !tagText || !encryptedText) {
    throw new ArcaError("No se pudo acceder al cache seguro del prestador.");
  }

  try {
    const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedText, "base64url")),
      decipher.final()
    ]).toString("utf8");
  } catch (error) {
    if (error instanceof ArcaError) {
      throw error;
    }
    throw new ArcaError("No se pudo acceder al cache seguro del prestador.");
  }
}

function getEncryptionKey(): Buffer {
  const secret = process.env.ARCA_PROVIDER_TOKEN_ENCRYPTION_KEY?.trim();
  if (!secret) {
    throw new ArcaError("La configuración del prestador no está disponible.");
  }

  return createHash("sha256")
    .update("fox-point:arca-provider-token-cache:v1:\0")
    .update(secret)
    .digest();
}
