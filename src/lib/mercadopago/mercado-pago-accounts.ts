import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { MercadoPagoAccountView } from "./mercado-pago-types";

type MercadoPagoAccountClient = Prisma.TransactionClient | typeof prisma;

export async function getMercadoPagoAccountViews(
  client: MercadoPagoAccountClient = prisma
): Promise<MercadoPagoAccountView[]> {
  const accounts = await client.mercadoPagoAccount.findMany({
    where: { deletedAt: null },
    orderBy: [{ defaultAccount: "desc" }, { enabled: "desc" }, { name: "asc" }]
  });

  return accounts.map((account) => ({
    id: account.id,
    name: account.name,
    enabled: account.enabled,
    environment: account.environment,
    publicKey: account.publicKey,
    collectorId: account.collectorId,
    storeId: account.storeId,
    externalStoreId: account.externalStoreId,
    storeName: account.storeName,
    posId: account.posId,
    externalPosId: account.externalPosId,
    posName: account.posName,
    posCategory: account.posCategory,
    posCreatedAt: account.posCreatedAt?.toISOString() ?? null,
    lastPosSetupAt: account.lastPosSetupAt?.toISOString() ?? null,
    lastPosSetupStep: account.lastPosSetupStep,
    lastPosSetupStatus: account.lastPosSetupStatus,
    lastPosSetupError: account.lastPosSetupError,
    defaultAccount: account.defaultAccount,
    instructions: account.instructions,
    enableAmountMatching: account.enableAmountMatching,
    amountMatchingWindowMinutes: account.amountMatchingWindowMinutes,
    amountMatchingTolerance: account.amountMatchingTolerance.toString(),
    amountMatchingAutoApprove: account.amountMatchingAutoApprove,
    amountMatchingPollSeconds: account.amountMatchingPollSeconds,
    showRecentMovements: account.showRecentMovements,
    hasAccessToken: Boolean(account.accessToken)
  }));
}

export async function getActiveMercadoPagoAccountViews(
  client: MercadoPagoAccountClient = prisma
) {
  return (await getMercadoPagoAccountViews(client)).filter((account) => account.enabled);
}

export async function getMercadoPagoAccountWithToken(id: string) {
  return prisma.mercadoPagoAccount.findFirst({
    where: {
      id,
      enabled: true,
      deletedAt: null
    }
  });
}
