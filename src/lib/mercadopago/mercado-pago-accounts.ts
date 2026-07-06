import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { refreshMercadoPagoOAuthAccountIfNeeded } from "./mercado-pago-oauth";
import { revealMercadoPagoToken } from "./mercado-pago-secrets";
import type { MercadoPagoAccountView } from "./mercado-pago-types";

type MercadoPagoAccountClient = Prisma.TransactionClient | typeof prisma;

export async function getMercadoPagoAccountViews(
  businessId: string,
  client: MercadoPagoAccountClient = prisma
): Promise<MercadoPagoAccountView[]> {
  if (!businessId) return [];
  const accounts = await client.mercadoPagoAccount.findMany({
    where: {
      deletedAt: null,
      businessId
    },
    orderBy: [{ defaultAccount: "desc" }, { enabled: "desc" }, { name: "asc" }]
  });

  return accounts.map((account) => ({
    id: account.id,
    name: account.name,
    enabled: account.enabled,
    connectionType: account.connectionType,
    environment: account.environment,
    mpUserId: account.mpUserId,
    accountNickname: account.accountNickname,
    accountEmail: account.accountEmail,
    oauthTokenExpiresAt: account.oauthTokenExpiresAt?.toISOString() ?? null,
    oauthConnectedAt: account.oauthConnectedAt?.toISOString() ?? null,
    oauthLastRefreshAt: account.oauthLastRefreshAt?.toISOString() ?? null,
    oauthRequiresReconnect: account.oauthRequiresReconnect,
    lastConnectionTestAt: account.lastConnectionTestAt?.toISOString() ?? null,
    lastConnectionStatus: account.lastConnectionStatus,
    lastConnectionMessage: account.lastConnectionMessage,
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
  businessId: string,
  client: MercadoPagoAccountClient = prisma
) {
  if (!businessId) return [];
  return (await getMercadoPagoAccountViews(businessId, client)).filter((account) => account.enabled);
}

export async function getMercadoPagoAccountWithToken(id: string, businessId?: string) {
  const account = await prisma.mercadoPagoAccount.findFirst({
    where: {
      id,
      enabled: true,
      deletedAt: null,
      ...(businessId ? { businessId } : {})
    }
  });

  if (!account) {
    return null;
  }

  return refreshMercadoPagoOAuthAccountIfNeeded({
    ...account,
    accessToken: revealMercadoPagoToken(account.accessToken)
  });
}
