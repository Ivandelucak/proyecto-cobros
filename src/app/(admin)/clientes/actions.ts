"use server";

import { CustomerAccountMovementType, PaymentMethod } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-auth";
import { createAuditLog } from "@/lib/audit-log";
import { createCustomerAccountMovement, getCustomerBalance } from "@/lib/customer-account";
import { parseLocalizedDecimal } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export type CustomerFormState = {
  error?: string;
  success?: string;
};

const initialPath = "/clientes";

export async function createCustomerAction(
  _state: CustomerFormState,
  formData: FormData
): Promise<CustomerFormState> {
  const user = await requireAdminPage();

  try {
    const customer = await prisma.customer.create({
      data: parseCustomerForm(formData)
    });
    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entity: "Customer",
      entityId: customer.id,
      description: `Creo el cliente ${customer.name}.`
    });
  } catch (error) {
    return { error: getErrorMessage(error) };
  }

  revalidatePath(initialPath);
  redirect(initialPath);
}

export async function updateCustomerAction(
  customerId: string,
  _state: CustomerFormState,
  formData: FormData
): Promise<CustomerFormState> {
  const user = await requireAdminPage();

  try {
    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: parseCustomerForm(formData)
    });
    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entity: "Customer",
      entityId: customer.id,
      description: `Actualizo el cliente ${customer.name}.`
    });
  } catch (error) {
    return { error: getErrorMessage(error) };
  }

  revalidatePath(initialPath);
  revalidatePath(`/clientes/${customerId}`);
  redirect(`/clientes/${customerId}`);
}

export async function setCustomerActiveAction(customerId: string, active: boolean) {
  const user = await requireAdminPage();

  const customer = await prisma.customer.update({
    where: { id: customerId },
    data: { active }
  });

  await createAuditLog({
    userId: user.id,
    action: active ? "REACTIVATE" : "DEACTIVATE",
    entity: "Customer",
    entityId: customer.id,
    description: `${active ? "Reactivo" : "Desactivo"} el cliente ${customer.name}.`
  });

  revalidatePath(initialPath);
  revalidatePath(`/clientes/${customerId}`);
}

export async function registerCustomerPaymentAction(
  customerId: string,
  _state: CustomerFormState,
  formData: FormData
): Promise<CustomerFormState> {
  const user = await requireAdminPage();

  try {
    const amount = parseLocalizedDecimal(formData.get("amount")).toDecimalPlaces(2);
    if (amount.lte(0)) {
      throw new Error("El monto debe ser mayor a cero.");
    }

    const balance = await getCustomerBalance(customerId);
    if (amount.gt(balance)) {
      throw new Error("El pago no puede superar el saldo pendiente.");
    }

    const method = parsePaymentMethod(formData.get("paymentMethod"));
    await prisma.$transaction(async (tx) => {
      await createCustomerAccountMovement(tx, {
        customerId,
        type: CustomerAccountMovementType.PAYMENT,
        amount,
        reason: readOptional(formData, "notes") ?? "Pago de cuenta corriente",
        paymentMethod: method,
        userId: user.id
      });
    });

    await createAuditLog({
      userId: user.id,
      action: "PAYMENT",
      entity: "Customer",
      entityId: customerId,
      description: "Registro pago de cuenta corriente.",
      metadata: { amount: amount.toString(), paymentMethod: method }
    });

    revalidatePath(initialPath);
    revalidatePath(`/clientes/${customerId}`);
    revalidatePath("/reportes");
    return { success: "Pago registrado." };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function adjustCustomerBalanceAction(
  customerId: string,
  _state: CustomerFormState,
  formData: FormData
): Promise<CustomerFormState> {
  const user = await requireAdminPage();

  try {
    const amount = parseLocalizedDecimal(formData.get("amount")).toDecimalPlaces(2);
    if (amount.equals(0)) {
      throw new Error("El ajuste no puede ser cero.");
    }

    const reason = readRequired(formData, "reason");
    await prisma.$transaction(async (tx) => {
      await createCustomerAccountMovement(tx, {
        customerId,
        type: CustomerAccountMovementType.ADJUSTMENT,
        amount,
        reason,
        userId: user.id
      });
    });

    await createAuditLog({
      userId: user.id,
      action: "ADJUST",
      entity: "Customer",
      entityId: customerId,
      description: "Ajusto saldo de cuenta corriente.",
      metadata: { amount: amount.toString(), reason }
    });

    revalidatePath(initialPath);
    revalidatePath(`/clientes/${customerId}`);
    revalidatePath("/reportes");
    return { success: "Saldo ajustado." };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

function parseCustomerForm(formData: FormData) {
  const name = readRequired(formData, "name");

  return {
    name,
    document: readOptional(formData, "document"),
    phone: readOptional(formData, "phone"),
    email: readOptional(formData, "email"),
    address: readOptional(formData, "address"),
    notes: readOptional(formData, "notes"),
    active: formData.get("active") === "on"
  };
}

function parsePaymentMethod(value: FormDataEntryValue | null): PaymentMethod {
  const method = String(value ?? "");
  const allowed: PaymentMethod[] = [
    PaymentMethod.CASH,
    PaymentMethod.DEBIT,
    PaymentMethod.CREDIT,
    PaymentMethod.TRANSFER,
    PaymentMethod.MERCADOPAGO
  ];

  if (!allowed.includes(method as PaymentMethod)) {
    throw new Error("Medio de pago invalido.");
  }

  return method as PaymentMethod;
}

function readRequired(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) {
    throw new Error("Completa los campos obligatorios.");
  }
  return value;
}

function readOptional(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim() || null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo completar la operacion.";
}
