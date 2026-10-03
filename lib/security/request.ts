const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function configuredOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function isTrustedStateChangingRequest(request: Request): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;

  const expectedOrigin = configuredOrigin();
  const origin = request.headers.get("origin")?.trim();
  if (origin) return expectedOrigin ? origin === expectedOrigin : origin === new URL(request.url).origin;

  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (fetchSite === "cross-site" || fetchSite === "same-site") return false;

  return true;
}
