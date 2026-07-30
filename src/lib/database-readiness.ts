import { prisma } from "@/lib/prisma";

const DEFAULT_TIMEOUT_MS = 3_000;

export async function checkDatabaseReadiness(
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<boolean> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new DatabaseReadinessTimeoutError());
        }, timeoutMs);
      })
    ]);

    return true;
  } catch {
    return false;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

class DatabaseReadinessTimeoutError extends Error {
  constructor() {
    super("Database readiness check timed out.");
  }
}
