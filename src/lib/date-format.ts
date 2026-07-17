export const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";

type ArgentinaCalendarParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export type ArgentinaDateRange = {
  from: string;
  to: string;
  startUtc: Date;
  endUtcExclusive: Date;
};

const argentinaCalendarFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ARGENTINA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: ARGENTINA_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  hourCycle: "h23"
});

const timeFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: ARGENTINA_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  hourCycle: "h23"
});

export function formatDateTimeStable(value: Date | string | number) {
  const parts = getParts(dateTimeFormatter, value);
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

export function formatDateTimeConfigured(
  value: Date | string | number,
  locale = "es-AR",
  timeZone = ARGENTINA_TIME_ZONE
) {
  const formatter = new Intl.DateTimeFormat(locale || "es-AR", {
    timeZone: timeZone || ARGENTINA_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23"
  });
  const parts = getParts(formatter, value);
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

export function formatTimeStable(value: Date | string | number) {
  const parts = getParts(timeFormatter, value);
  return `${parts.hour}:${parts.minute}`;
}

export function formatArgentinaDateInput(value: Date = new Date()) {
  const parts = getArgentinaCalendarParts(value);
  return formatArgentinaCalendarDate(parts);
}

export function isArgentinaDateInput(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

export function addArgentinaCalendarDays(value: string, days: number) {
  const parts = parseArgentinaDateInput(value);
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate()
  ).padStart(2, "0")}`;
}

export function countArgentinaCalendarDays(from: string, to: string) {
  const fromParts = parseArgentinaDateInput(from);
  const toParts = parseArgentinaDateInput(to);
  const fromTimestamp = Date.UTC(fromParts.year, fromParts.month - 1, fromParts.day);
  const toTimestamp = Date.UTC(toParts.year, toParts.month - 1, toParts.day);

  if (toTimestamp < fromTimestamp) {
    throw new Error("La fecha Desde no puede ser posterior a Hasta.");
  }

  return Math.floor((toTimestamp - fromTimestamp) / 86_400_000) + 1;
}

export function startOfArgentinaWeek(value: string = formatArgentinaDateInput()) {
  const parts = parseArgentinaDateInput(value);
  const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;

  return addArgentinaCalendarDays(value, -daysSinceMonday);
}

export function startOfArgentinaMonth(value: string = formatArgentinaDateInput()) {
  const parts = parseArgentinaDateInput(value);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-01`;
}

export function getArgentinaDateRange(from: string, to: string): ArgentinaDateRange {
  const fromParts = parseArgentinaDateInput(from);
  parseArgentinaDateInput(to);

  if (from > to) {
    throw new Error("La fecha Desde no puede ser posterior a Hasta.");
  }

  return {
    from,
    to,
    startUtc: argentinaMidnightToUtc(fromParts),
    endUtcExclusive: argentinaMidnightToUtc(parseArgentinaDateInput(addArgentinaCalendarDays(to, 1)))
  };
}

function parseArgentinaDateInput(value: string): Pick<ArgentinaCalendarParts, "year" | "month" | "day"> {
  if (!isArgentinaDateInput(value)) {
    throw new Error("Ingresá una fecha válida en formato AAAA-MM-DD.");
  }

  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function argentinaMidnightToUtc(
  target: Pick<ArgentinaCalendarParts, "year" | "month" | "day">
) {
  const targetAsUtc = Date.UTC(target.year, target.month - 1, target.day);
  let timestamp = targetAsUtc;

  // Convert the requested local midnight through the IANA zone instead of the server's timezone.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = getArgentinaCalendarParts(new Date(timestamp));
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second
    );
    const nextTimestamp = timestamp + (targetAsUtc - actualAsUtc);

    if (nextTimestamp === timestamp) {
      break;
    }

    timestamp = nextTimestamp;
  }

  return new Date(timestamp);
}

function getArgentinaCalendarParts(value: Date): ArgentinaCalendarParts {
  const parts = Object.fromEntries(
    argentinaCalendarFormatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  ) as Record<keyof ArgentinaCalendarParts, number>;

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second
  };
}

function formatArgentinaCalendarDate(value: Pick<ArgentinaCalendarParts, "year" | "month" | "day">) {
  return `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
}

function getParts(formatter: Intl.DateTimeFormat, value: Date | string | number) {
  const date = value instanceof Date ? value : new Date(value);
  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  ) as Record<string, string>;
}
