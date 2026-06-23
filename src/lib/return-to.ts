type SearchParamValue = string | string[] | undefined;
type SearchParamsInput =
  | Record<string, SearchParamValue>
  | URLSearchParams
  | {
      forEach: (callback: (value: string, key: string) => void) => void;
    }
  | null
  | undefined;

export function isSafeInternalReturnTo(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return false;
  }

  if (/^https?:\/\//i.test(trimmed) || /[\u0000-\u001F\u007F]/.test(trimmed)) {
    return false;
  }

  return true;
}

export function getSafeInternalReturnTo(
  value: unknown,
  fallback = "/ventas"
) {
  return isSafeInternalReturnTo(value) ? value.trim() : fallback;
}

export function buildReturnToHref(
  pathname: string,
  searchParams?: SearchParamsInput
) {
  const safePathname = isSafeInternalReturnTo(pathname) ? pathname : "/";
  const query = serializeSearchParams(searchParams);
  const href = query ? `${safePathname}?${query}` : safePathname;

  return isSafeInternalReturnTo(href) ? href : safePathname;
}

export function buildTicketHref(
  saleId: string,
  returnTo?: string | null,
  options?: { print?: boolean }
) {
  const href = `/ventas/${encodeURIComponent(saleId)}/ticket${
    options?.print ? "?print=1" : ""
  }`;
  return appendReturnTo(href, returnTo);
}

export function buildSaleDetailHref(saleId: string, returnTo?: string | null) {
  return appendReturnTo(`/ventas/${encodeURIComponent(saleId)}`, returnTo);
}

function appendReturnTo(href: string, returnTo?: string | null) {
  if (!isSafeInternalReturnTo(returnTo)) {
    return href;
  }

  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}returnTo=${encodeURIComponent(returnTo.trim())}`;
}

function serializeSearchParams(searchParams?: SearchParamsInput) {
  if (!searchParams) {
    return "";
  }

  const params = new URLSearchParams();

  if (hasForEach(searchParams)) {
    searchParams.forEach((value, key) => {
      params.append(key, value);
    });
    return params.toString();
  }

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
      continue;
    }

    if (typeof value === "string") {
      params.set(key, value);
    }
  }

  return params.toString();
}

function hasForEach(value: SearchParamsInput): value is {
  forEach: (callback: (value: string, key: string) => void) => void;
} {
  return Boolean(
    value &&
      typeof value === "object" &&
      "forEach" in value &&
      typeof value.forEach === "function"
  );
}
