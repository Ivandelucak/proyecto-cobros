import "server-only";

import { FiscalEnvironment } from "@prisma/client";
import { decryptProviderToken, encryptProviderToken } from "@/lib/fiscal/provider-token-crypto.server";
import { prisma } from "@/lib/prisma";

const TOKEN_REFRESH_SAFETY_MS = 10 * 60 * 1000;

type ProviderAuthCacheKey = {
  certificateFingerprint: string;
  environment: FiscalEnvironment;
  service: string;
};

export type CachedProviderAuth = {
  token: string;
  sign: string;
  expirationTime: Date;
};

export async function getCachedProviderAuth(
  key: ProviderAuthCacheKey,
  options: { allowNearExpiry?: boolean } = {}
): Promise<CachedProviderAuth | null> {
  const cache = await prisma.fiscalProviderAuthCache.findUnique({
    where: {
      certificateFingerprint_environment_service: key
    }
  });

  if (!cache) {
    return null;
  }

  const minimumExpiration = Date.now() + (options.allowNearExpiry ? 0 : TOKEN_REFRESH_SAFETY_MS);
  if (cache.expiresAt.getTime() <= minimumExpiration) {
    return null;
  }

  let token: string;
  let sign: string;
  try {
    token = decryptProviderToken(cache.encryptedToken);
    sign = decryptProviderToken(cache.encryptedSign);
  } catch {
    // A rotated encryption key or damaged payload invalidates only this shared cache entry.
    await prisma.fiscalProviderAuthCache.deleteMany({
      where: {
        certificateFingerprint: key.certificateFingerprint,
        environment: key.environment,
        service: key.service
      }
    });
    return null;
  }

  if (!token || !sign) {
    return null;
  }

  return { token, sign, expirationTime: cache.expiresAt };
}

export async function saveCachedProviderAuth(
  key: ProviderAuthCacheKey,
  value: CachedProviderAuth
) {
  await prisma.fiscalProviderAuthCache.upsert({
    where: {
      certificateFingerprint_environment_service: key
    },
    update: {
      encryptedToken: encryptProviderToken(value.token),
      encryptedSign: encryptProviderToken(value.sign),
      expiresAt: value.expirationTime
    },
    create: {
      ...key,
      encryptedToken: encryptProviderToken(value.token),
      encryptedSign: encryptProviderToken(value.sign),
      expiresAt: value.expirationTime
    }
  });
}
