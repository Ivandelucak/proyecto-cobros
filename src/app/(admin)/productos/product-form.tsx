"use client";

import { useActionState, useState, useTransition } from "react";
import { BarcodeFeedback } from "@/components/barcode/barcode-feedback";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { useBarcodeScanner } from "@/lib/barcode/use-barcode-scanner";
import {
  calculateProfitPercentageFromCost,
  calculatePriceFromCostProfit,
  calculateSalePriceIncrease,
  formatEditablePercentage,
  formatEditableMoney,
  parseEditableDecimal,
} from "@/lib/product-price-adjustment";
import { formatARS } from "@/lib/money";
import { checkProductBarcodeAction, type ProductFormState } from "./actions";

type CategoryOption = {
  id: string;
  name: string;
};

type ProductFormValues = {
  name?: string;
  barcode?: string | null;
  sku?: string | null;
  brand?: string | null;
  categoryId?: string;
  salePrice?: string;
  cost?: string | null;
  stock?: string;
  minStock?: string;
  unitType?: string;
  allowsDecimalQuantity?: boolean;
  quickAccess?: boolean;
  active?: boolean;
  vatRate?: string | null;
  vatArcaCode?: number | null;
  taxTreatment?: string | null;
};

type ProductFormProps = {
  action: (
    state: ProductFormState,
    formData: FormData,
  ) => Promise<ProductFormState>;
  categories: CategoryOption[];
  initialValues?: ProductFormValues;
  productId?: string;
  submitLabel: string;
};

const initialState: ProductFormState = {};

type PricingMode = "manual" | "sale-price-increase" | "cost-profit";

const units = [
  ["UNIT", "Unidad"],
  ["KG", "Kilogramo"],
  ["GR", "Gramo"],
  ["LITER", "Litro"],
  ["METER", "Metro"],
  ["PACK", "Pack"],
  ["BOX", "Caja"],
  ["OTHER", "Otro"],
];

const decimalSuggestedUnits = new Set(["KG", "GR", "LITER", "METER"]);

const fiscalTaxOptions = [
  [
    "INHERIT",
    "Heredar configuracion fiscal",
    "Usa el IVA por defecto de configuracion fiscal.",
  ],
  ["TAXED_21", "Gravado 21%", "Codigo ARCA 5."],
  ["TAXED_10_5", "Gravado 10.5%", "Codigo ARCA 4."],
  ["TAXED_27", "Gravado 27%", "Codigo ARCA 6."],
  ["TAXED_0", "Gravado 0%", "Codigo ARCA 3."],
  ["EXEMPT", "Exento", "Suma en importe exento."],
  ["NON_TAXABLE", "No gravado", "Suma en importe no gravado."],
] as const;

export function ProductForm({
  action,
  categories,
  initialValues,
  productId,
  submitLabel,
}: ProductFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [isCheckingBarcode, startCheckingBarcode] = useTransition();
  const [barcode, setBarcode] = useState(initialValues?.barcode ?? "");
  const [barcodeNotice, setBarcodeNotice] = useState<{
    message: string;
    tone: "ok" | "error" | "info";
    productId?: string;
  } | null>(null);
  const [unitType, setUnitType] = useState(initialValues?.unitType ?? "UNIT");
  const [allowsDecimal, setAllowsDecimal] = useState(
    Boolean(initialValues?.allowsDecimalQuantity),
  );
  const [fiscalTax, setFiscalTax] = useState(
    productFiscalTaxValue(initialValues),
  );
  const [originalSalePrice] = useState(() => initialValues?.salePrice ?? "0");
  const [salePrice, setSalePrice] = useState(
    () => initialValues?.salePrice ?? "0",
  );
  const [cost, setCost] = useState(() => initialValues?.cost ?? "");
  const [increasePercentage, setIncreasePercentage] = useState("");
  const [costProfitPercentage, setCostProfitPercentage] = useState(() =>
    getInformativeCostProfitPercentage(
      initialValues?.salePrice ?? "0",
      initialValues?.cost ?? "",
    ),
  );
  const [isCostProfitEdited, setIsCostProfitEdited] = useState(false);
  const [pricingMode, setPricingMode] = useState<PricingMode>("manual");
  const isNewProduct = !initialValues;
  const calculatedSalePrice = calculateSalePriceIncrease(
    originalSalePrice,
    increasePercentage,
  );
  const calculatedCostProfitPrice = calculatePriceFromCostProfit(
    cost,
    costProfitPercentage,
  );
  const activeCalculatedPrice =
    pricingMode === "sale-price-increase"
      ? calculatedSalePrice
      : pricingMode === "cost-profit"
        ? calculatedCostProfitPrice
        : null;
  const pricePreview = activeCalculatedPrice ?? parseEditableDecimal(salePrice);
  const hasInvalidIncrease =
    pricingMode === "sale-price-increase" &&
    Boolean(increasePercentage.trim()) &&
    calculatedSalePrice === null;
  const hasInvalidCostProfit =
    pricingMode === "cost-profit" &&
    Boolean(costProfitPercentage.trim()) &&
    calculatedCostProfitPrice === null;
  const currentCost = parseEditableDecimal(cost);
  const isActiveCostProfit = pricingMode === "cost-profit" && isCostProfitEdited;

  function setInformativeCostProfitPercentage(
    nextSalePrice: string,
    nextCost: string,
  ) {
    setCostProfitPercentage(
      getInformativeCostProfitPercentage(nextSalePrice, nextCost),
    );
    setIsCostProfitEdited(false);
  }

  function handleUnitChange(value: string) {
    setUnitType(value);
    if (decimalSuggestedUnits.has(value)) {
      setAllowsDecimal(true);
    }
  }

  function handleIncreasePercentageChange(value: string) {
    setIncreasePercentage(value);
    setIsCostProfitEdited(false);

    if (!value.trim()) {
      setPricingMode("manual");
      setSalePrice(originalSalePrice);
      setInformativeCostProfitPercentage(originalSalePrice, cost);
      return;
    }

    setPricingMode("sale-price-increase");
    const calculated = calculateSalePriceIncrease(originalSalePrice, value);
    if (calculated === null) {
      setCostProfitPercentage("");
      return;
    }

    const nextSalePrice =
      parseEditableDecimal(value) === 0
        ? originalSalePrice
        : formatEditableMoney(calculated);
    setSalePrice(nextSalePrice);
    setInformativeCostProfitPercentage(nextSalePrice, cost);
  }

  function handleSalePriceChange(value: string) {
    setSalePrice(value);
    setPricingMode("manual");
    setIncreasePercentage("");
    setInformativeCostProfitPercentage(value, cost);
  }

  function handleCostChange(value: string) {
    setCost(value);

    if (
      pricingMode !== "cost-profit" ||
      !isCostProfitEdited ||
      !costProfitPercentage.trim()
    ) {
      setInformativeCostProfitPercentage(salePrice, value);
      return;
    }

    const calculated = calculatePriceFromCostProfit(
      value,
      costProfitPercentage,
    );
    if (calculated !== null) {
      setSalePrice(formatEditableMoney(calculated));
    }
  }

  function handleCostProfitPercentageChange(value: string) {
    setIncreasePercentage("");

    if (!value.trim()) {
      setPricingMode("manual");
      setSalePrice(originalSalePrice);
      setInformativeCostProfitPercentage(originalSalePrice, cost);
      return;
    }

    setCostProfitPercentage(value);
    setIsCostProfitEdited(true);
    setPricingMode("cost-profit");
    const calculated = calculatePriceFromCostProfit(cost, value);
    if (calculated !== null) {
      setSalePrice(formatEditableMoney(calculated));
    }
  }

  function verifyBarcode(value: string) {
    const code = value.trim();
    if (!code) {
      setBarcodeNotice(null);
      return;
    }

    startCheckingBarcode(async () => {
      const result = await checkProductBarcodeAction(code, productId);
      if (result.status === "available") {
        setBarcodeNotice({
          message: "Codigo disponible.",
          tone: "ok",
        });
        return;
      }

      if (result.status === "current") {
        setBarcodeNotice({
          message: "Es el codigo actual de este producto.",
          tone: "info",
        });
        return;
      }

      const stateLabel = result.product.deletedAt
        ? "eliminado"
        : result.product.active
          ? "activo"
          : "inactivo";
      setBarcodeNotice({
        message: `Codigo ya existe en otro producto: ${result.product.name} (${stateLabel}).`,
        tone: "error",
        productId: result.product.id,
      });
    });
  }

  useBarcodeScanner({
    preventDefaultOnScan: true,
    onScan: (code) => {
      setBarcode(code);
      verifyBarcode(code);
    },
  });

  return (
    <form action={formAction} className="space-y-5 pb-20">
      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </div>
      ) : null}

      <Card className="p-5">
        <SectionTitle
          title="Informacion basica"
          description="Datos para identificar el producto en caja, busqueda y listados."
        />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Nombre">
            <Input
              name="name"
              defaultValue={initialValues?.name ?? ""}
              required
            />
          </Field>
          <Field label="Categoria">
            <Select
              name="categoryId"
              defaultValue={initialValues?.categoryId ?? ""}
              required
            >
              <option value="">Seleccionar</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Codigo de barras">
            <Input
              name="barcode"
              value={barcode}
              onChange={(event) => {
                const value = event.target.value;
                setBarcode(value);
                if (!value.trim()) {
                  setBarcodeNotice(null);
                }
              }}
              onBlur={(event) => verifyBarcode(event.target.value)}
              placeholder="Escanea o pega el codigo"
              className="h-12 text-base"
            />
            <div className="mt-2 space-y-2">
              <BarcodeFeedback
                code={barcodeNotice ? barcode || null : null}
                message={
                  barcodeNotice
                    ? isCheckingBarcode
                      ? "Verificando codigo..."
                      : barcodeNotice.message
                    : null
                }
                tone={barcodeNotice?.tone}
              />
              {barcodeNotice?.productId ? (
                <LinkButton
                  href={`/productos/${barcodeNotice.productId}/editar`}
                  size="sm"
                  variant="outline"
                >
                  Abrir producto
                </LinkButton>
              ) : null}
            </div>
          </Field>
          <Field label="SKU">
            <Input name="sku" defaultValue={initialValues?.sku ?? ""} />
          </Field>
          <Field label="Marca">
            <Input name="brand" defaultValue={initialValues?.brand ?? ""} />
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle
          title="Precio y stock"
          description="Importes y cantidades operativas. Los cambios de stock quedan auditados."
        />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Precio de venta">
            <Input
              name="salePrice"
              inputMode="decimal"
              value={salePrice}
              onChange={(event) => handleSalePriceChange(event.target.value)}
              required
            />
          </Field>
          <Field label="Costo">
            <Input
              name="cost"
              inputMode="decimal"
              value={cost}
              onChange={(event) => handleCostChange(event.target.value)}
            />
          </Field>
          {!isNewProduct ? (
            <>
              <Field label="Aumento porcentual">
                <div className="flex overflow-hidden rounded-md border border-gray-300 bg-white focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[color:var(--primary-soft)] dark:border-[#344457] dark:bg-[#0B1015]">
                  <Input
                    value={increasePercentage}
                    onChange={(event) =>
                      handleIncreasePercentageChange(event.target.value)
                    }
                    inputMode="decimal"
                    aria-describedby="sale-price-increase-help"
                    className="min-w-0 border-0 bg-transparent shadow-none focus:ring-0 dark:bg-transparent"
                  />
                  <span className="grid w-11 place-items-center border-l border-gray-300 text-sm font-bold text-gray-500 dark:border-[#344457] dark:text-[#A9B6C2]">
                    %
                  </span>
                </div>
                <span
                  id="sale-price-increase-help"
                  className="block text-xs text-gray-500 dark:text-[#7F8D9A]"
                >
                  {hasInvalidIncrease
                    ? "Ingresa un porcentaje valido mayor o igual a cero."
                    : "Calcula el precio de venta aplicando este porcentaje al precio original."}
                </span>
              </Field>
              <Field label="Ganancia sobre costo (%)">
                <div className="flex overflow-hidden rounded-md border border-gray-300 bg-white focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[color:var(--primary-soft)] dark:border-[#344457] dark:bg-[#0B1015]">
                  <Input
                    value={costProfitPercentage}
                    onChange={(event) =>
                      handleCostProfitPercentageChange(event.target.value)
                    }
                    inputMode="decimal"
                    aria-describedby="cost-profit-help"
                    className="min-w-0 border-0 bg-transparent shadow-none focus:ring-0 dark:bg-transparent"
                  />
                  <span className="grid w-11 place-items-center border-l border-gray-300 text-sm font-bold text-gray-500 dark:border-[#344457] dark:text-[#A9B6C2]">
                    %
                  </span>
                </div>
                <span
                  id="cost-profit-help"
                  className="block text-xs text-gray-500 dark:text-[#7F8D9A]"
                >
                  {hasInvalidCostProfit
                    ? currentCost === null || currentCost <= 0
                      ? "Ingresa un costo valido mayor a cero para calcular la ganancia."
                      : "Ingresa una ganancia valida mayor o igual a -100%."
                    : isActiveCostProfit
                      ? "Calcula el precio de venta sumando este porcentaje al costo actual."
                      : costProfitPercentage
                        ? "Porcentaje actual calculado segun el precio de venta y el costo."
                        : "No hay un porcentaje valido mientras el costo sea cero, vacio o invalido."}
                </span>
              </Field>
              <div className="rounded-md border border-[color:var(--panel-border)] bg-[var(--panel-bg-secondary)] p-3">
                <p className="text-xs font-medium text-[var(--text-secondary)]">
                  Nuevo precio calculado
                </p>
                <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                  {pricePreview === null ? "-" : formatARS(pricePreview)}
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  {pricingMode === "sale-price-increase"
                    ? `Base: precio original ${formatARS(originalSalePrice)} + ${increasePercentage || "0"}%`
                    : pricingMode === "cost-profit" && currentCost !== null
                      ? `Base: costo ${formatARS(currentCost)} + ${costProfitPercentage || "0"}% de ganancia`
                      : "Edicion manual"}
                </p>
              </div>
            </>
          ) : null}
          <Field label="Stock">
            <Input
              name="stock"
              inputMode="decimal"
              defaultValue={initialValues?.stock ?? "0"}
              required
            />
          </Field>
          <Field label="Stock minimo">
            <Input
              name="minStock"
              inputMode="decimal"
              defaultValue={initialValues?.minStock ?? "0"}
              required
            />
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle
          title="Configuracion de venta"
          description="Define como se vende en caja y como aparece para el cajero."
        />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Unidad">
            <Select
              name="unitType"
              value={unitType}
              onChange={(event) => handleUnitChange(event.target.value)}
            >
              {units.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <CheckCard
            name="allowsDecimalQuantity"
            checked={allowsDecimal}
            onChange={setAllowsDecimal}
            title="Permite cantidad decimal"
            description="Se activa automaticamente para kg, gr, litro o metro."
          />
          <CheckCard
            name="active"
            defaultChecked={initialValues?.active ?? true}
            title="Activo"
            description="Disponible para vender y buscar en caja."
          />
          <CheckCard
            name="quickAccess"
            defaultChecked={initialValues?.quickAccess ?? false}
            title="Acceso rapido en caja"
            description="Aparece entre los productos rapidos del POS."
          />
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle
          title="Fiscal / IVA"
          description="Define el tratamiento fiscal del producto para preparar comprobantes ARCA."
        />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Tratamiento fiscal">
            <Select
              name="fiscalTax"
              value={fiscalTax}
              onChange={(event) => setFiscalTax(event.target.value)}
            >
              {fiscalTaxOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-[#273342] dark:bg-[#121922] dark:text-[#A9B6C2]">
            {fiscalTaxHelp(fiscalTax)}
          </div>
        </div>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 bg-gray-100/95 px-1 py-3 backdrop-blur dark:border-[#273342] dark:bg-[#121922]/95">
        <LinkButton href="/productos" variant="ghost">
          Cancelar
        </LinkButton>
        {isNewProduct ? (
          <Button
            type="submit"
            name="submitIntent"
            value="createAnother"
            disabled={pending}
          >
            {pending ? "Guardando..." : "Guardar y cargar otro"}
          </Button>
        ) : null}
        <Button
          type="submit"
          name="submitIntent"
          value="save"
          variant="primary"
          disabled={pending}
        >
          {pending ? "Guardando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function productFiscalTaxValue(initialValues?: ProductFormValues) {
  if (!initialValues?.taxTreatment) {
    return "INHERIT";
  }

  if (initialValues.taxTreatment === "EXEMPT") {
    return "EXEMPT";
  }

  if (initialValues.taxTreatment === "NON_TAXABLE") {
    return "NON_TAXABLE";
  }

  const rate = Number(initialValues.vatRate ?? 21);
  if (rate === 10.5) {
    return "TAXED_10_5";
  }
  if (rate === 27) {
    return "TAXED_27";
  }
  if (rate === 0) {
    return "TAXED_0";
  }

  return "TAXED_21";
}

function fiscalTaxHelp(value: string) {
  return (
    fiscalTaxOptions.find(([optionValue]) => optionValue === value)?.[2] ?? ""
  );
}

function getInformativeCostProfitPercentage(
  salePrice: string | null | undefined,
  cost: string | null | undefined
) {
  return formatEditablePercentage(
    calculateProfitPercentageFromCost(salePrice ?? "", cost ?? "")
  );
}

function SectionTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
        {title}
      </h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-[#A9B6C2]">
        {description}
      </p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-gray-700 dark:text-[#A9B6C2]">
        {label}
      </span>
      {children}
    </label>
  );
}

function CheckCard({
  name,
  title,
  description,
  checked,
  defaultChecked,
  onChange,
}: {
  name: string;
  title: string;
  description: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700 shadow-sm dark:border-[#344457] dark:bg-[#121922] dark:text-[#A9B6C2]">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={(event) => onChange?.(event.target.checked)}
        className="mt-0.5 h-4 w-4 accent-brand-600"
      />
      <span>
        <span className="block font-medium text-gray-950 dark:text-[#F3F7FA]">
          {title}
        </span>
        <span className="mt-1 block text-xs text-gray-500 dark:text-[#7F8D9A]">
          {description}
        </span>
      </span>
    </label>
  );
}
