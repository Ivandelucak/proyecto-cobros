export class ArcaError extends Error {
  constructor(
    message: string,
    readonly details?: string
  ) {
    super(message);
    this.name = "ArcaError";
  }
}

export function toArcaError(error: unknown, fallback: string) {
  if (error instanceof ArcaError) {
    return error;
  }

  if (error instanceof Error) {
    return new ArcaError(fallback, error.message);
  }

  return new ArcaError(fallback);
}

export function sanitizeArcaDetail(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value
    .replace(/<(?:[\w-]+:)?token\b[^>]*>[\s\S]*?<\/(?:[\w-]+:)?token>/gi, "<token>[oculto]</token>")
    .replace(/<(?:[\w-]+:)?sign\b[^>]*>[\s\S]*?<\/(?:[\w-]+:)?sign>/gi, "<sign>[oculto]</sign>")
    .replace(/<(?:[\w-]+:)?in0\b[^>]*>[\s\S]*?<\/(?:[\w-]+:)?in0>/gi, "<in0>[CMS oculto]</in0>")
    .replace(/-----BEGIN [\s\S]*?-----END [^-]+-----/g, "[PEM oculto]")
    .slice(0, 2000);
}
