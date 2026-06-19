const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";

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

function getParts(formatter: Intl.DateTimeFormat, value: Date | string | number) {
  const date = value instanceof Date ? value : new Date(value);
  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  ) as Record<string, string>;
}
