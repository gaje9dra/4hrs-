const DEFAULT_REDIRECT = "/";

export function getSafeAuthRedirect(value: string | string[] | undefined, fallback = DEFAULT_REDIRECT): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || typeof candidate !== "string") return fallback;
  if (candidate.length > 2048 || /[\u0000-\u001F\u007F\\]/.test(candidate)) return fallback;
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return fallback;

  try {
    const parsed = new URL(candidate, "https://4hrs.invalid");
    if (parsed.origin !== "https://4hrs.invalid") return fallback;
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return fallback;
  }
}

export function authRedirectHref(pathname: string): string {
  return getSafeAuthRedirect(pathname);
}
