import { mercadoPagoRequest } from "./mercado-pago-client";
import { getMercadoPagoAccountWithToken } from "./mercado-pago-accounts";

type MercadoPagoUserResponse = {
  id?: string | number;
  nickname?: string;
  email?: string;
};

export async function testMercadoPagoAccountConnection(accountId: string) {
  const account = await getMercadoPagoAccountWithToken(accountId);
  if (!account) {
    throw new Error("La cuenta de Mercado Pago no esta disponible.");
  }

  return testMercadoPagoAccessToken(account.accessToken);
}

export async function testMercadoPagoAccessToken(accessToken: string) {
  const trimmedToken = accessToken.trim();
  if (!trimmedToken) {
    throw new Error("Ingresa un Access Token para probar la conexion.");
  }

  const user = await mercadoPagoRequest<MercadoPagoUserResponse>({
    accessToken: trimmedToken,
    path: "/users/me"
  });

  const collectorId = user.id ? String(user.id) : null;
  const accountLabel = [user.nickname, user.email].filter(Boolean).join(" - ");
  const testedAt = new Date().toISOString();

  return {
    ok: true,
    message: collectorId
      ? `Conexion OK. Cuenta ${collectorId}${accountLabel ? ` (${accountLabel})` : ""}.`
      : "Conexion OK con Mercado Pago.",
    collectorId,
    nickname: user.nickname ?? null,
    email: user.email ?? null,
    testedAt
  };
}
