export function escapeXml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function extractTag(xml: string, tagName: string) {
  const match = new RegExp(
    `<(?:[\\w-]+:)?${tagName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tagName}>`,
    "i"
  ).exec(xml);

  return match ? decodeXmlEntities(match[1].trim()) : null;
}

export function extractSoapFault(xml: string) {
  const faultString = extractTag(xml, "faultstring");
  const faultCode = extractTag(xml, "faultcode");

  return faultString ? [faultCode, faultString].filter(Boolean).join(": ") : null;
}

export function extractItems(xml: string, itemTag: string) {
  const itemRegex = new RegExp(
    `<(?:[\\w-]+:)?${itemTag}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${itemTag}>`,
    "gi"
  );
  const items: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    items.push(match[1]);
  }

  return items;
}

export function formatArcaDate(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}
