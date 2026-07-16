"use client";

import { useEffect, useRef, useState } from "react";
import { AppModal } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatARS } from "@/lib/money";
import type { SaleSurchargeInput, SaleSurchargeType } from "@/lib/sale-surcharge";

type SaleSurchargeDialogProps = {
  open: boolean;
  subtotal: number;
  initialValue: SaleSurchargeInput | null;
  onClose: () => void;
  onApply: (surcharge: SaleSurchargeInput) => void;
  onRemove: () => void;
};

export function SaleSurchargeDialog({
  open,
  subtotal,
  initialValue,
  onClose,
  onApply,
  onRemove
}: SaleSurchargeDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<SaleSurchargeType>("PERCENTAGE");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setType(initialValue?.type ?? "PERCENTAGE");
      setValue(initialValue?.value ?? "");
      setError(null);
      inputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialValue?.type, initialValue?.value, open]);

  const parsedValue = parseSurchargeValue(value);
  const calculatedAmount = parsedValue === null || parsedValue <= 0
    ? 0
    : type === "PERCENTAGE"
      ? roundMoney((subtotal * parsedValue) / 100)
      : roundMoney(parsedValue);
  const total = roundMoney(subtotal + calculatedAmount);

  const apply = () => {
    if (parsedValue === null || parsedValue <= 0) {
      setError("Ingresá un valor de recargo mayor a cero.");
      return;
    }
    if (type === "PERCENTAGE" && parsedValue > 1000) {
      setError("El porcentaje de recargo supera el limite permitido.");
      return;
    }

    onApply({ type, value: normalizeSurchargeValue(value) });
  };

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title="Agregar recargo"
      description="Se aplica a toda la venta antes de calcular el saldo pendiente."
      panelClassName="max-w-md"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          {initialValue ? (
            <Button type="button" variant="danger" onClick={onRemove}>
              Quitar recargo
            </Button>
          ) : <span />}
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" variant="primary" onClick={apply}>
              Aplicar recargo
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <SummaryLine label="Subtotal actual" value={formatARS(subtotal)} />
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
            Tipo
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <TypeButton active={type === "PERCENTAGE"} onClick={() => setType("PERCENTAGE")}>
              Porcentaje
            </TypeButton>
            <TypeButton active={type === "FIXED"} onClick={() => setType("FIXED")}>
              Importe fijo
            </TypeButton>
          </div>
        </div>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
            Valor
          </span>
          <div className="mt-1.5 flex overflow-hidden rounded-md border border-[color:var(--panel-border)] bg-[var(--input-bg)] focus-within:border-[color:var(--primary)] focus-within:ring-2 focus-within:ring-brand-100">
            <Input
              ref={inputRef}
              value={value}
              inputMode="decimal"
              onChange={(event) => {
                setValue(event.target.value);
                setError(null);
              }}
              placeholder={type === "PERCENTAGE" ? "10" : "500"}
              className="h-11 border-0 bg-transparent text-base font-bold shadow-none focus:ring-0"
            />
            <span className="grid w-12 place-items-center border-l border-[color:var(--panel-border)] text-sm font-black text-[var(--text-secondary)]">
              {type === "PERCENTAGE" ? "%" : "$"}
            </span>
          </div>
        </label>
        {error ? <p role="alert" className="badge-danger rounded-md px-3 py-2 text-sm">{error}</p> : null}
        <div className="app-panel-elevated space-y-2 rounded-lg p-3">
          <SummaryLine label="Recargo calculado" value={formatARS(calculatedAmount)} />
          <div className="border-t border-[color:var(--panel-border)] pt-2">
            <SummaryLine label="Total final" value={formatARS(total)} strong />
          </div>
        </div>
      </div>
    </AppModal>
  );
}

function TypeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={active
        ? "min-h-10 rounded-md border border-[color:var(--primary)] bg-[var(--primary-soft)] px-3 text-sm font-bold text-[var(--text-primary)]"
        : "min-h-10 rounded-md border border-[color:var(--panel-border)] bg-[var(--panel-bg-elevated)] px-3 text-sm font-bold text-[var(--text-secondary)] hover:border-[color:var(--panel-border-strong)]"}
    >
      {children}
    </button>
  );
}

function SummaryLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex items-center justify-between gap-3 text-base font-black text-[var(--text-primary)]" : "flex items-center justify-between gap-3 text-sm text-[var(--text-secondary)]"}>
      <span>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function parseSurchargeValue(value: string) {
  const clean = value.trim().replace(/\$/g, "").replace(/\s/g, "");
  if (!clean) return null;
  const normalized = clean.includes(",") && clean.includes(".")
    ? clean.lastIndexOf(",") > clean.lastIndexOf(".")
      ? clean.replace(/\./g, "").replace(",", ".")
      : clean.replace(/,/g, "")
    : clean.replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function normalizeSurchargeValue(value: string) {
  const parsed = parseSurchargeValue(value);
  return parsed === null ? "" : String(parsed);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
