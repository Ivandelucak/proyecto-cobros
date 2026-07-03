import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { MercadoPagoApiError } from "@/lib/mercadopago/mercado-pago-client";
import { searchRecentMercadoPagoPayments } from "@/lib/mercadopago/mercado-pago-search";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || (user.role !== Role.ADMIN && user.role !== Role.CASHIER)) {
    return NextResponse.json(
      { ok: false, message: "No autorizado.", technicalDetail: null, movements: [] },
      { status: 401 }
    );
  }

  const { id } = await context.params;
  const url = new URL(request.url);
  const rangeMinutes = clampInt(
    Number(url.searchParams.get("rangeMinutes") ?? "10"),
    1,
    1440
  );
  const limit = clampInt(Number(url.searchParams.get("limit") ?? "20"), 1, 50);
  const status = sanitizeStatus(url.searchParams.get("status")) ?? "approved";

  try {
    const movements = await searchRecentMercadoPagoPayments({
      accountId: id,
      minutes: rangeMinutes,
      limit,
      status
    });

    return NextResponse.json({
      ok: true,
      movements: movements.map((movement) => ({
        id: movement.id,
        dateCreated: movement.dateCreated,
        dateApproved: movement.dateApproved,
        status: movement.status,
        statusDetail: movement.statusDetail,
        amount: movement.amount,
        currency: movement.currency,
        paymentMethodId: movement.paymentMethodId,
        paymentTypeId: movement.paymentTypeId,
        operationType: movement.operationType,
        description: movement.description,
        externalReference: movement.externalReference,
        payerLabelSafe: movement.payerLabelSafe,
        accountName: movement.accountName,
        alreadyUsed: movement.alreadyUsed,
        usedSaleNumber: movement.usedSaleNumber,
        rawSummary: movement.rawSummary,
        paymentMethod: movement.paymentMethod,
        paymentType: movement.paymentType,
        payerLabel: movement.payerLabel
      })),
      message:
        movements.length > 0
          ? `${movements.length} cobro${movements.length === 1 ? "" : "s"} detectado${movements.length === 1 ? "" : "s"}.`
          : "Sin cobros aprobados en el rango seleccionado.",
      technicalDetail: null,
      queriedAt: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        movements: [],
        message:
          error instanceof Error
            ? error.message
            : "No se pudieron consultar cobros Mercado Pago.",
        technicalDetail: formatTechnicalDetail(error),
        queriedAt: new Date().toISOString()
      },
      { status: error instanceof MercadoPagoApiError ? error.status : 500 }
    );
  }
}

function sanitizeStatus(value: string | null) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) {
    return null;
  }

  return /^[a-z_]+$/.test(text) ? text : null;
}

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function formatTechnicalDetail(error: unknown) {
  if (error instanceof MercadoPagoApiError) {
    return JSON.stringify(error.details, null, 2);
  }

  if (error instanceof Error) {
    return JSON.stringify({ message: error.message }, null, 2);
  }

  return null;
}
