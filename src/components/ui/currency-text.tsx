import { formatARS, type MoneyInput } from "@/lib/money";

type CurrencyTextProps = {
  value: MoneyInput;
};

export function CurrencyText({ value }: CurrencyTextProps) {
  return <span>{formatARS(value)}</span>;
}
