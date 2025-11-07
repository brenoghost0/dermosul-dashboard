const DEFAULT_PRODUCT_PATH_PREFIX = "/p/";
const DEFAULT_UTM_PARAMS = {
  utm_source: "chat",
  utm_medium: "assistente",
  utm_campaign: "recomendacao",
};
let warnedMissingBase = false;

type ProductIdentifier = {
  slug?: string | null;
  id?: string | null;
  path?: string | null;
};

type BuildProductUrlOptions = {
  /**
   * Override origin for specific environments (rare). If omitted, the function resolves automatically.
   */
  baseOverride?: string | null;
  /**
   * Include Dermosul chat UTM parameters. Default: true.
   */
  includeUtm?: boolean;
  /**
   * Extra query params to merge with the UTMs.
   */
  query?: Record<string, string | number | undefined | null>;
};

type ResolvedBase = {
  origin: string | null;
  pathOnly: boolean;
};

const ORDERS_OF_PRIORITY: Array<keyof NodeJS.ProcessEnv> = [
  "BASE_URL",
  "STAGING_BASE_URL",
  "DEV_BASE_URL",
];

function sanitizeOrigin(origin: string): string | null {
  if (!origin) return null;
  try {
    const normalized = origin.trim();
    const url = new URL(normalized);
    return url.origin.replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function resolveBaseUrl(baseOverride?: string | null): ResolvedBase {
  if (baseOverride) {
    const sanitized = sanitizeOrigin(baseOverride);
    if (sanitized) {
      return { origin: sanitized, pathOnly: false };
    }
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    const sanitized = sanitizeOrigin(window.location.origin);
    if (sanitized) {
      return { origin: sanitized, pathOnly: false };
    }
  }

  for (const key of ORDERS_OF_PRIORITY) {
    const value = process.env?.[key];
    if (!value) continue;
    const sanitized = sanitizeOrigin(value);
    if (sanitized) {
      return { origin: sanitized, pathOnly: false };
    }
  }

  return { origin: null, pathOnly: true };
}

function buildProductPath(identifier: ProductIdentifier): string {
  if (identifier.path) {
    return identifier.path.startsWith("/")
      ? identifier.path
      : `/${identifier.path}`;
  }

  const target = identifier.slug || identifier.id;
  if (!target) {
    throw new Error("buildProductUrl: slug ou id são obrigatórios.");
  }
  const encoded = encodeURIComponent(target);
  return `${DEFAULT_PRODUCT_PATH_PREFIX}${encoded}`;
}

function buildSearchParams(
  includeUtm: boolean,
  extra?: BuildProductUrlOptions["query"]
): URLSearchParams | null {
  const params = new URLSearchParams();
  if (includeUtm) {
    for (const [key, value] of Object.entries(DEFAULT_UTM_PARAMS)) {
      params.set(key, value);
    }
  }

  if (extra) {
    for (const [key, rawValue] of Object.entries(extra)) {
      if (rawValue === undefined || rawValue === null) continue;
      params.set(key, String(rawValue));
    }
  }

  return params.size ? params : null;
}

export function buildProductUrl(
  identifier: ProductIdentifier,
  options: BuildProductUrlOptions = {}
): string {
  const path = buildProductPath(identifier);
  const { origin, pathOnly } = resolveBaseUrl(options.baseOverride);
  const searchParams = buildSearchParams(
    options.includeUtm !== false,
    options.query
  );

  if (origin) {
    const url = new URL(path, origin);
    if (searchParams) {
      for (const [key, value] of searchParams.entries()) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  if (typeof window === "undefined" && !warnedMissingBase) {
    console.warn(
      "[url-builder] BASE_URL/STAGING_BASE_URL/DEV_BASE_URL não configuradas. Retornando caminho relativo."
    );
    warnedMissingBase = true;
  }

  if (searchParams) {
    return `${path}?${searchParams.toString()}`;
  }
  return path;
}

export function stripBaseUrlCache() {
  warnedMissingBase = false;
}
