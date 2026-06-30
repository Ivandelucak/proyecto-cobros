import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  MercadoPagoApiError,
  mercadoPagoRequest
} from "./mercado-pago-client";
import { getMercadoPagoAccountWithToken } from "./mercado-pago-accounts";

type MercadoPagoUserResponse = {
  id?: string | number;
};

type MercadoPagoStoreResponse = {
  id?: string | number;
  name?: string;
  external_id?: string;
};

type MercadoPagoPosResponse = {
  id?: string | number;
  name?: string;
  external_id?: string;
  external_store_id?: string;
  store_id?: string | number;
  category?: string | number;
  date_created?: string;
};

type CreatePosPayloadOptions = {
  includeExternalStoreId?: boolean;
  storeIdAsString?: boolean;
};

type MercadoPagoSearchResponse<T> = {
  results?: T[];
};

export type MercadoPagoPosSetupInput = {
  storeName: string;
  externalStoreId: string;
  posName: string;
  externalPosId: string;
  posCategory?: string | null;
  location: {
    streetName: string;
    streetNumber: string;
    cityName: string;
    stateName: string;
    latitude: string;
    longitude: string;
    reference?: string | null;
  };
};

type ValidatedMercadoPagoPosSetupInput = Omit<
  MercadoPagoPosSetupInput,
  "location"
> & {
  location: {
    streetName: string;
    streetNumber: string;
    cityName: string;
    stateName: string;
    latitude: number;
    longitude: number;
    reference: string;
  };
};

export type MercadoPagoPosSetupStepName =
  | "DETECT_USER"
  | "SEARCH_STORE"
  | "CREATE_STORE"
  | "SEARCH_POS"
  | "CREATE_POS"
  | "TEST_POS";

type MercadoPagoPosSetupStepStatus =
  | "OK"
  | "NOT_FOUND"
  | "EXISTING"
  | "ERROR";

export type MercadoPagoPosSetupStep = {
  step: MercadoPagoPosSetupStepName;
  status: MercadoPagoPosSetupStepStatus;
  message: string;
  storeId?: string | null;
  externalStoreId?: string | null;
  posId?: string | null;
  externalPosId?: string | null;
  technicalDetail?: string | null;
};

export type MercadoPagoPosSetupResult = {
  ok: boolean;
  message: string;
  status: "CREATED" | "EXISTING" | "OK";
  storeId: string | null;
  externalStoreId: string;
  storeName: string;
  posId: string | null;
  externalPosId: string;
  posName: string;
  steps: MercadoPagoPosSetupStep[];
};

export class MercadoPagoPosSetupError extends Error {
  step: MercadoPagoPosSetupStepName;
  steps: MercadoPagoPosSetupStep[];
  technicalDetail: string;

  constructor({
    message,
    step,
    steps,
    detail
  }: {
    message: string;
    step: MercadoPagoPosSetupStepName;
    steps: MercadoPagoPosSetupStep[];
    detail: unknown;
  }) {
    super(message);
    this.name = "MercadoPagoPosSetupError";
    this.step = step;
    this.steps = steps;
    this.technicalDetail = JSON.stringify(detail, null, 2);
  }
}

type MercadoPagoAccountWithToken = NonNullable<
  Awaited<ReturnType<typeof getMercadoPagoAccountWithToken>>
>;

export async function setupMercadoPagoStoreAndPos(
  accountId: string,
  rawInput: MercadoPagoPosSetupInput
): Promise<MercadoPagoPosSetupResult> {
  const account = await requireMercadoPagoAccount(accountId);
  const input = validatePosSetupInput(rawInput);
  const steps: MercadoPagoPosSetupStep[] = [];

  await prisma.mercadoPagoAccount.update({
    where: { id: account.id },
    data: {
      lastPosSetupAt: new Date(),
      lastPosSetupStep: "DETECT_USER",
      lastPosSetupStatus: "PENDING",
      lastPosSetupError: null
    }
  });

  const collectorId = await getCollectorIdForSetup(account, steps);
  let store: MercadoPagoStoreResponse;
  try {
    store = await ensureMercadoPagoStore(account, collectorId, input, steps);
  } catch (error) {
    await markPosSetupError(
      account.id,
      getSetupErrorMessage(error),
      "STORE_ERROR",
      getSetupErrorStep(error, "SEARCH_STORE")
    );
    throw error;
  }
  const lastStoreStep = getLastStepName(steps) ?? "CREATE_STORE";

  await persistStoreSetup(account.id, collectorId, store, input, lastStoreStep);

  let posResult: Awaited<ReturnType<typeof ensureMercadoPagoPos>>;
  try {
    posResult = await ensureMercadoPagoPos(account, store, input, steps);
  } catch (error) {
    await markPosSetupError(
      account.id,
      getSetupErrorMessage(error),
      "POS_ERROR",
      getSetupErrorStep(error, "CREATE_POS")
    );
    throw error;
  }
  const { pos, status, lastStep } = posResult;

  await persistPosSetup(account.id, collectorId, store, pos, input, lastStep);

  return {
    ok: true,
    message:
      status === "EXISTING"
        ? "Caja Mercado Pago existente vinculada correctamente."
        : "Sucursal y caja Mercado Pago creadas correctamente.",
    status,
    storeId: stringifyId(store.id),
    externalStoreId: store.external_id ?? input.externalStoreId,
    storeName: store.name ?? input.storeName,
    posId: stringifyId(pos.id),
    externalPosId: pos.external_id ?? input.externalPosId,
    posName: pos.name ?? input.posName,
    steps
  };
}

export async function testMercadoPagoPosSetup(
  accountId: string,
  rawInput: Pick<MercadoPagoPosSetupInput, "externalStoreId" | "externalPosId">
): Promise<MercadoPagoPosSetupResult> {
  const account = await requireMercadoPagoAccount(accountId);
  const externalStoreId = validateExternalId(rawInput.externalStoreId, {
    label: "Sucursal external_id",
    maxLength: 60
  });
  const externalPosId = validateExternalId(rawInput.externalPosId, {
    label: "Caja external_id",
    maxLength: 40
  });
  const steps: MercadoPagoPosSetupStep[] = [];
  const collectorId = await getCollectorIdForSetup(account, steps);
  const store = await searchStoreForSetup(
    account.accessToken,
    collectorId,
    externalStoreId,
    steps
  );
  const pos = await searchPosForSetup(account.accessToken, externalPosId, steps);

  if (!pos) {
    throw setupError({
      step: "TEST_POS",
      message: "La caja Mercado Pago no existe o no pertenece a esta cuenta.",
      error: new Error("POS not found"),
      steps,
      extra: { externalStoreId, externalPosId }
    });
  }

  const input = {
    storeName: store?.name ?? account.storeName ?? "POS Universal",
    externalStoreId,
    posName: pos.name ?? account.posName ?? "Caja principal",
    externalPosId,
    posCategory: pos.category ? String(pos.category) : account.posCategory,
    location: {
      streetName: "",
      streetNumber: "",
      cityName: "",
      stateName: "",
      latitude: 0,
      longitude: 0,
      reference: ""
    }
  };

  await persistPosSetup(account.id, collectorId, store, pos, input, "TEST_POS");

  return {
    ok: true,
    message: "Caja Mercado Pago encontrada y vinculada correctamente.",
    status: "OK",
    storeId: stringifyId(store?.id ?? pos.store_id),
    externalStoreId: store?.external_id ?? pos.external_store_id ?? externalStoreId,
    storeName: input.storeName,
    posId: stringifyId(pos.id),
    externalPosId: pos.external_id ?? externalPosId,
    posName: input.posName,
    steps
  };
}

async function requireMercadoPagoAccount(accountId: string) {
  const account = await getMercadoPagoAccountWithToken(accountId);
  if (!account) {
    throw new Error("La cuenta de Mercado Pago no esta disponible.");
  }
  if (!account.accessToken.trim()) {
    throw new Error("La cuenta Mercado Pago no tiene Access Token cargado.");
  }
  return account;
}

async function getCollectorIdForSetup(
  account: MercadoPagoAccountWithToken,
  steps: MercadoPagoPosSetupStep[]
) {
  if (account.collectorId) {
    steps.push({
      step: "DETECT_USER",
      status: "OK",
      message: "Usuario Mercado Pago detectado desde la cuenta guardada."
    });
    return account.collectorId;
  }

  try {
    const user = await mercadoPagoRequest<MercadoPagoUserResponse>({
      accessToken: account.accessToken,
      path: "/users/me"
    });
    const collectorId = stringifyId(user.id);
    if (!collectorId) {
      throw new Error("Mercado Pago no devolvio user id.");
    }

    await prisma.mercadoPagoAccount.update({
      where: { id: account.id },
      data: { collectorId }
    });
    account.collectorId = collectorId;
    steps.push({
      step: "DETECT_USER",
      status: "OK",
      message: "Usuario Mercado Pago detectado con /users/me."
    });
    return collectorId;
  } catch (error) {
    await markPosSetupError(
      account.id,
      "No se pudo detectar el usuario Mercado Pago de la cuenta.",
      "STORE_ERROR",
      "DETECT_USER"
    );
    throw setupError({
      step: "DETECT_USER",
      message: "No se pudo detectar el usuario Mercado Pago de la cuenta.",
      error,
      steps
    });
  }
}

async function ensureMercadoPagoStore(
  account: MercadoPagoAccountWithToken,
  collectorId: string,
  input: ValidatedMercadoPagoPosSetupInput,
  steps: MercadoPagoPosSetupStep[]
) {
  const storedStore = getStoredStore(account, input.externalStoreId);
  if (storedStore) {
    steps.push({
      step: "SEARCH_STORE",
      status: "OK",
      message: "Sucursal encontrada en la configuracion local.",
      storeId: stringifyId(storedStore.id),
      externalStoreId: storedStore.external_id ?? input.externalStoreId
    });
    return storedStore;
  }

  const foundStore = await searchStoreForSetup(
    account.accessToken,
    collectorId,
    input.externalStoreId,
    steps
  );
  if (foundStore) {
    return foundStore;
  }

  try {
    const createdStore = await createMercadoPagoStore(
      account.accessToken,
      collectorId,
      input
    );
    assertStoreId(createdStore);
    steps.push({
      step: "CREATE_STORE",
      status: "OK",
      message: "Sucursal creada correctamente.",
      storeId: stringifyId(createdStore.id),
      externalStoreId: createdStore.external_id ?? input.externalStoreId
    });
    return createdStore;
  } catch (error) {
    if (isProbableExistingStoreError(error)) {
      const recoveredStore = await searchStoreForSetup(
        account.accessToken,
        collectorId,
        input.externalStoreId,
        steps,
        { silentNotFound: true }
      );
      if (recoveredStore) {
        steps.push({
          step: "CREATE_STORE",
          status: "EXISTING",
          message: "La sucursal ya existia y fue recuperada.",
          storeId: stringifyId(recoveredStore.id),
          externalStoreId: recoveredStore.external_id ?? input.externalStoreId
        });
        return recoveredStore;
      }
    }

    await markPosSetupError(
      account.id,
      "No se pudo crear la sucursal Mercado Pago.",
      "STORE_ERROR",
      "CREATE_STORE"
    );
    throw setupError({
      step: "CREATE_STORE",
      message: "No se pudo crear la sucursal Mercado Pago.",
      error,
      steps
    });
  }
}

async function searchStoreForSetup(
  accessToken: string,
  collectorId: string,
  externalStoreId: string,
  steps: MercadoPagoPosSetupStep[],
  options: { silentNotFound?: boolean } = {}
) {
  try {
    const response = await mercadoPagoRequest<
      MercadoPagoSearchResponse<MercadoPagoStoreResponse>
    >({
      accessToken,
      path: `/users/${collectorId}/stores/search`,
      query: { external_id: externalStoreId }
    });
    const store =
      response.results?.find((item) => item.external_id === externalStoreId) ??
      response.results?.[0] ??
      null;

    if (store) {
      steps.push({
        step: "SEARCH_STORE",
        status: "OK",
        message: "Sucursal existente encontrada.",
        storeId: stringifyId(store.id),
        externalStoreId: store.external_id ?? externalStoreId
      });
      return store;
    }

    steps.push({
      step: "SEARCH_STORE",
      status: "NOT_FOUND",
      message: "No existia sucursal previa. Se creara una nueva.",
      externalStoreId
    });
    return null;
  } catch (error) {
    if (isStoreNotFoundError(error)) {
      if (!options.silentNotFound) {
        steps.push({
          step: "SEARCH_STORE",
          status: "NOT_FOUND",
          message: "No existia sucursal previa. Se creara una nueva.",
          externalStoreId
        });
      }
      return null;
    }

    throw setupError({
      step: "SEARCH_STORE",
      message: "No se pudo buscar la sucursal Mercado Pago existente.",
      error,
      steps
    });
  }
}

async function ensureMercadoPagoPos(
  account: MercadoPagoAccountWithToken,
  store: MercadoPagoStoreResponse,
  input: ValidatedMercadoPagoPosSetupInput,
  steps: MercadoPagoPosSetupStep[]
) {
  const existingPos = await searchPosForSetup(
    account.accessToken,
    input.externalPosId,
    steps
  );
  if (existingPos) {
    return { pos: existingPos, status: "EXISTING" as const, lastStep: "SEARCH_POS" as const };
  }

  try {
    const pos = await createMercadoPagoPos(account.accessToken, store, input);
    steps.push({
      step: "CREATE_POS",
      status: "OK",
      message: "Caja creada correctamente.",
      storeId: stringifyId(store.id),
      externalStoreId: input.externalStoreId,
      posId: stringifyId(pos.id),
      externalPosId: pos.external_id ?? input.externalPosId
    });
    return { pos, status: "CREATED" as const, lastStep: "CREATE_POS" as const };
  } catch (error) {
    if (isMercadoPagoError(error, "point_of_sale_exists")) {
      const recoveredPos = await searchPosForSetup(
        account.accessToken,
        input.externalPosId,
        steps,
        { silentNotFound: true }
      );
      if (recoveredPos) {
        steps.push({
          step: "CREATE_POS",
          status: "EXISTING",
          message: "La caja ya existia y fue recuperada.",
          storeId: stringifyId(store.id),
          externalStoreId: input.externalStoreId,
          posId: stringifyId(recoveredPos.id),
          externalPosId: recoveredPos.external_id ?? input.externalPosId
        });
        return { pos: recoveredPos, status: "EXISTING" as const, lastStep: "CREATE_POS" as const };
      }

      await markPosSetupError(
        account.id,
        "Ya existe una caja con ese identificador. Usa otro External POS ID.",
        "POS_ERROR",
        "CREATE_POS"
      );
      throw setupError({
        step: "CREATE_POS",
        message:
          "Ya existe una caja con ese identificador. Usa otro External POS ID.",
        error,
        steps,
        extra: {
          storeId: stringifyId(store.id),
          externalStoreId: input.externalStoreId,
          externalPosId: input.externalPosId
        }
      });
    }

    const message = isStoreNotFoundText(error)
      ? "La caja se intento crear con una sucursal inexistente. Reintenta creando primero la sucursal."
      : "Sucursal creada, pero no se pudo crear la caja.";
    await markPosSetupError(account.id, message, "POS_ERROR", "CREATE_POS");
    throw setupError({
      step: "CREATE_POS",
      message,
      error,
      steps,
      extra: {
        storeId: stringifyId(store.id),
        externalStoreId: input.externalStoreId,
        externalPosId: input.externalPosId
      }
    });
  }
}

async function searchPosForSetup(
  accessToken: string,
  externalPosId: string,
  steps: MercadoPagoPosSetupStep[],
  options: { silentNotFound?: boolean } = {}
) {
  try {
    const response = await mercadoPagoRequest<
      MercadoPagoSearchResponse<MercadoPagoPosResponse>
    >({
      accessToken,
      path: "/pos",
      query: { external_id: externalPosId }
    });
    const pos =
      response.results?.find((item) => item.external_id === externalPosId) ??
      response.results?.[0] ??
      null;

    if (pos) {
      steps.push({
        step: "SEARCH_POS",
        status: "OK",
        message: "Caja existente encontrada.",
        posId: stringifyId(pos.id),
        externalPosId: pos.external_id ?? externalPosId
      });
      return pos;
    }

    if (!options.silentNotFound) {
      steps.push({
        step: "SEARCH_POS",
        status: "NOT_FOUND",
        message: "No existia caja previa. Se creara una nueva.",
        externalPosId
      });
    }
    return null;
  } catch (error) {
    if (isPosNotFoundError(error)) {
      if (!options.silentNotFound) {
        steps.push({
          step: "SEARCH_POS",
          status: "NOT_FOUND",
          message: "No existia caja previa. Se creara una nueva.",
          externalPosId
        });
      }
      return null;
    }

    throw setupError({
      step: "SEARCH_POS",
      message: "No se pudo buscar la caja Mercado Pago existente.",
      error,
      steps
    });
  }
}

async function createMercadoPagoStore(
  accessToken: string,
  collectorId: string,
  input: ValidatedMercadoPagoPosSetupInput
) {
  return mercadoPagoRequest<MercadoPagoStoreResponse>({
    accessToken,
    path: `/users/${collectorId}/stores`,
    method: "POST",
    body: compactObject({
      name: input.storeName,
      external_id: input.externalStoreId,
      location: {
        street_name: input.location.streetName,
        street_number: input.location.streetNumber,
        city_name: input.location.cityName,
        state_name: input.location.stateName,
        latitude: input.location.latitude,
        longitude: input.location.longitude,
        reference: input.location.reference
      }
    })
  });
}

async function createMercadoPagoPos(
  accessToken: string,
  store: MercadoPagoStoreResponse,
  input: ValidatedMercadoPagoPosSetupInput
) {
  assertStoreId(store);
  const attempts: Array<{
    options: CreatePosPayloadOptions;
    shouldRun: (error?: unknown) => boolean;
  }> = [
    {
      options: {},
      shouldRun: () => true
    },
    {
      options: { storeIdAsString: true },
      shouldRun: (error) => isStoreIdTypeError(error)
    },
    {
      options: { includeExternalStoreId: true },
      shouldRun: (error) => isExternalStoreIdRequiredError(error)
    }
  ];
  let lastError: unknown = null;

  for (const attempt of attempts) {
    if (!attempt.shouldRun(lastError ?? undefined)) {
      continue;
    }

    try {
      return await mercadoPagoRequest<MercadoPagoPosResponse>({
        accessToken,
        path: "/pos",
        method: "POST",
        body: buildCreatePosPayload(store, input, attempt.options)
      });
    } catch (error) {
      lastError = error;
      if (
        attempt.options.includeExternalStoreId &&
        isMercadoPagoError(error, "non_existent_external_store_id")
      ) {
        throw createErrorWithCause(
          "Mercado Pago no reconocio el external_store_id, pero la sucursal existe por store_id. Revisar integracion POS.",
          error
        );
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("No se pudo crear la caja Mercado Pago.");
}

function buildCreatePosPayload(
  store: MercadoPagoStoreResponse,
  input: ValidatedMercadoPagoPosSetupInput,
  options: CreatePosPayloadOptions
) {
  const storeId = stringifyId(store.id);
  return compactObject({
    name: input.posName,
    fixed_amount: true,
    store_id: options.storeIdAsString ? storeId : toMercadoPagoIdValue(store.id),
    external_store_id: options.includeExternalStoreId
      ? store.external_id ?? input.externalStoreId
      : undefined,
    external_id: input.externalPosId,
    category: input.posCategory ? Number(input.posCategory) : undefined
  });
}

async function persistStoreSetup(
  accountId: string,
  collectorId: string,
  store: MercadoPagoStoreResponse,
  input: Pick<ValidatedMercadoPagoPosSetupInput, "storeName" | "externalStoreId">,
  lastStep: MercadoPagoPosSetupStepName
) {
  await prisma.mercadoPagoAccount.update({
    where: { id: accountId },
    data: {
      collectorId,
      storeId: stringifyId(store.id),
      externalStoreId: store.external_id ?? input.externalStoreId,
      storeName: store.name ?? input.storeName,
      lastPosSetupAt: new Date(),
      lastPosSetupStep: lastStep,
      lastPosSetupStatus: "STORE_CREATED",
      lastPosSetupError: null
    }
  });
}

async function persistPosSetup(
  accountId: string,
  collectorId: string,
  store: MercadoPagoStoreResponse | null,
  pos: MercadoPagoPosResponse,
  input: Pick<
    ValidatedMercadoPagoPosSetupInput,
    "storeName" | "externalStoreId" | "posName" | "externalPosId" | "posCategory"
  >,
  lastStep: MercadoPagoPosSetupStepName
) {
  await prisma.mercadoPagoAccount.update({
    where: { id: accountId },
    data: {
      collectorId,
      storeId: stringifyId(store?.id ?? pos.store_id) ?? undefined,
      externalStoreId: store?.external_id ?? pos.external_store_id ?? input.externalStoreId,
      storeName: store?.name ?? input.storeName,
      posId: stringifyId(pos.id),
      externalPosId: pos.external_id ?? input.externalPosId,
      posName: pos.name ?? input.posName,
      posCategory: pos.category ? String(pos.category) : input.posCategory ?? null,
      posCreatedAt: parseOptionalDate(pos.date_created),
      lastPosSetupAt: new Date(),
      lastPosSetupStep: lastStep,
      lastPosSetupStatus: "OK",
      lastPosSetupError: null
    }
  });
}

async function markPosSetupError(
  accountId: string | null,
  message: string,
  status: string,
  step: MercadoPagoPosSetupStepName,
  options: { skipWhenMissingAccount?: boolean } = {}
) {
  if (!accountId && options.skipWhenMissingAccount) {
    return;
  }
  if (!accountId) {
    throw new Error("No se pudo actualizar el estado de Mercado Pago.");
  }

  await prisma.mercadoPagoAccount.update({
    where: { id: accountId },
    data: {
      lastPosSetupAt: new Date(),
      lastPosSetupStep: step,
      lastPosSetupStatus: status,
      lastPosSetupError: message
    }
  });
}

function validatePosSetupInput(
  input: MercadoPagoPosSetupInput
): ValidatedMercadoPagoPosSetupInput {
  const storeName = validateText(input.storeName, "Nombre sucursal");
  const externalStoreId = validateExternalId(input.externalStoreId, {
    label: "Sucursal external_id",
    maxLength: 60
  });
  const posName = validateText(input.posName, "Nombre caja");
  const externalPosId = validateExternalId(input.externalPosId, {
    label: "Caja external_id",
    maxLength: 40
  });
  const posCategory = input.posCategory?.trim() || null;
  if (posCategory && !/^\d+$/.test(posCategory)) {
    throw new Error("La categoria/MCC debe ser numerica.");
  }

  return {
    storeName,
    externalStoreId,
    posName,
    externalPosId,
    posCategory,
    location: {
      streetName: validateText(input.location.streetName, "Calle"),
      streetNumber: validateText(input.location.streetNumber, "Numero"),
      cityName: validateText(input.location.cityName, "Ciudad"),
      stateName: validateText(input.location.stateName, "Provincia"),
      latitude: validateCoordinate(input.location.latitude, "Latitud", -90, 90),
      longitude: validateCoordinate(input.location.longitude, "Longitud", -180, 180),
      reference: input.location.reference?.trim() || ""
    }
  };
}

function validateText(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} es obligatorio.`);
  }
  return trimmed;
}

function validateExternalId(
  value: string,
  { label, maxLength }: { label: string; maxLength: number }
) {
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) {
    throw new Error(`${label} es obligatorio.`);
  }
  if (trimmed.length > maxLength) {
    throw new Error(`${label} debe tener maximo ${maxLength} caracteres.`);
  }
  if (!/^[A-Z0-9]+$/.test(trimmed)) {
    throw new Error(`${label} solo puede tener letras y numeros.`);
  }
  return trimmed;
}

function validateCoordinate(
  value: string,
  label: string,
  min: number,
  max: number
) {
  const normalized = value.trim().replace(",", ".");
  const parsed = Number(normalized);
  if (!normalized || !Number.isFinite(parsed)) {
    throw new Error(`${label} es obligatoria.`);
  }
  if (parsed < min || parsed > max) {
    throw new Error(`${label} esta fuera de rango.`);
  }
  return parsed;
}

function getStoredStore(
  account: MercadoPagoAccountWithToken,
  externalStoreId: string
): MercadoPagoStoreResponse | null {
  if (!account.storeId || account.externalStoreId !== externalStoreId) {
    return null;
  }

  return {
    id: account.storeId,
    external_id: account.externalStoreId,
    name: account.storeName ?? undefined
  };
}

function assertStoreId(store: MercadoPagoStoreResponse) {
  if (!stringifyId(store.id)) {
    throw new Error("Mercado Pago no devolvio el ID de la sucursal.");
  }
}

function setupError({
  step,
  message,
  error,
  steps,
  extra
}: {
  step: MercadoPagoPosSetupStepName;
  message: string;
  error: unknown;
  steps: MercadoPagoPosSetupStep[];
  extra?: Record<string, unknown>;
}) {
  const technicalDetail = serializeError(error);
  const failedStep = {
    step,
    status: "ERROR" as const,
    message,
    technicalDetail: JSON.stringify(technicalDetail, null, 2),
    ...(extra?.storeId ? { storeId: String(extra.storeId) } : {}),
    ...(extra?.externalStoreId ? { externalStoreId: String(extra.externalStoreId) } : {}),
    ...(extra?.posId ? { posId: String(extra.posId) } : {}),
    ...(extra?.externalPosId ? { externalPosId: String(extra.externalPosId) } : {})
  };
  const nextSteps = [...steps, failedStep];

  return new MercadoPagoPosSetupError({
    message,
    step,
    steps: nextSteps,
    detail: {
      step,
      message,
      ...extra,
      error: technicalDetail
    }
  });
}

function serializeError(error: unknown): unknown {
  if (error instanceof MercadoPagoPosSetupError) {
    return JSON.parse(error.technicalDetail) as unknown;
  }
  if (error instanceof MercadoPagoApiError) {
    return error.details;
  }
  if (error instanceof Error) {
    const cause = "cause" in error ? error.cause : null;
    return {
      message: error.message,
      ...(cause ? { cause: serializeError(cause) } : {})
    };
  }
  return error;
}

function createErrorWithCause(message: string, cause: unknown) {
  const error = new Error(message) as Error & { cause?: unknown };
  error.cause = cause;
  return error;
}

function getSetupErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }
  return "No se pudo configurar la caja Mercado Pago.";
}

function getSetupErrorStep(
  error: unknown,
  fallback: MercadoPagoPosSetupStepName
) {
  return error instanceof MercadoPagoPosSetupError ? error.step : fallback;
}

function isStoreNotFoundError(error: unknown) {
  return (
    error instanceof MercadoPagoApiError &&
    error.status === 404 &&
    errorText(error).includes("store_not_found")
  );
}

function isPosNotFoundError(error: unknown) {
  return (
    error instanceof MercadoPagoApiError &&
    error.status === 404 &&
    (errorText(error).includes("pos_not_found") ||
      errorText(error).includes("point of sale not found"))
  );
}

function isMercadoPagoError(error: unknown, code: string) {
  if (!(error instanceof MercadoPagoApiError)) {
    return false;
  }
  return errorText(error).includes(code.toLowerCase());
}

function isStoreNotFoundText(error: unknown) {
  return errorText(error).includes("store not found");
}

function isStoreIdTypeError(error: unknown) {
  const text = errorText(error);
  return (
    text.includes("pos_invalid_store_id") ||
    text.includes("invalid_store_id") ||
    (text.includes("store_id") && text.includes("type"))
  );
}

function isExternalStoreIdRequiredError(error: unknown) {
  const text = errorText(error);
  return (
    text.includes("external_store_id") &&
    (text.includes("required") ||
      text.includes("missing") ||
      text.includes("empty_required"))
  );
}

function isProbableExistingStoreError(error: unknown) {
  const text = errorText(error);
  return (
    text.includes("store") &&
    (text.includes("exists") ||
      text.includes("already") ||
      text.includes("external_id"))
  );
}

function errorText(error: unknown) {
  if (error instanceof MercadoPagoApiError) {
    return JSON.stringify(error.details.error).toLowerCase();
  }
  if (error instanceof Error) {
    return error.message.toLowerCase();
  }
  return JSON.stringify(error).toLowerCase();
}

function getLastStepName(steps: MercadoPagoPosSetupStep[]) {
  return steps.length > 0 ? steps[steps.length - 1]?.step : null;
}

function toMercadoPagoIdValue(value: string | number | undefined | null) {
  if (typeof value === "number") {
    return value;
  }
  const text = stringifyId(value);
  if (!text) {
    return value;
  }
  return /^\d+$/.test(text) ? Number(text) : text;
}

function parseOptionalDate(value: string | undefined) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function stringifyId(value: string | number | undefined | null) {
  return value === undefined || value === null ? null : String(value);
}

function compactObject<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => compactObject(item)) as T;
  }

  if (!value || typeof value !== "object" || value instanceof Prisma.Decimal) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined && entryValue !== null)
      .map(([key, entryValue]) => [key, compactObject(entryValue)])
  ) as T;
}
