type FetchLike = typeof fetch;

type QikinkTokenResponse = Readonly<{
  Accesstoken?: unknown;
  access_token?: unknown;
  token?: unknown;
  expires_in?: unknown;
}>;

export type QikinkApiCredentials = Readonly<{
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  mode: "test" | "live";
}>;

let cachedToken: string | null = null;
let cachedExpiry = 0;

function mode(): "test" | "live" {
  return process.env.FULFILLMENT_PROVIDER_MODE === "live" ? "live" : "test";
}

function baseUrl(): string {
  return mode() === "live" ? "https://api.qikink.com" : "https://sandbox.qikink.com";
}

export function getQikinkApiCredentials(): QikinkApiCredentials | null {
  const clientId = process.env.QIKINK_CLIENT_ID?.trim() ?? "";
  const clientSecret = mode() === "test"
    ? (process.env.QIKINK_SANDBOX_SECRET?.trim() || process.env.QIKINK_CLIENT_SECRET?.trim() || "")
    : (process.env.QIKINK_CLIENT_SECRET?.trim() ?? "");

  if (!clientId || !clientSecret) return null;

  return {
    clientId,
    clientSecret,
    baseUrl: baseUrl(),
    mode: mode(),
  };
}

function tokenFromResponse(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as QikinkTokenResponse;
  for (const candidate of [body.Accesstoken, body.access_token, body.token]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

export function clearQikinkAccessTokenCache(): void {
  cachedToken = null;
  cachedExpiry = 0;
}

export async function getQikinkAccessToken(options: {
  fetchImpl?: FetchLike;
  forceRefresh?: boolean;
  timeoutMs?: number;
} = {}): Promise<string> {
  const credentials = getQikinkApiCredentials();
  if (!credentials) {
    throw new Error("QIKINK_CLIENT_ID and QIKINK_CLIENT_SECRET are not configured.");
  }

  const now = Date.now();
  if (!options.forceRefresh && cachedToken && cachedExpiry > now + 30_000) {
    return cachedToken;
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? Number(process.env.FULFILLMENT_PROVIDER_TIMEOUT_MS ?? 10000);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000) {
    throw new Error("Qikink timeout configuration is invalid.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body = new URLSearchParams({
      ClientId: credentials.clientId,
      client_secret: credentials.clientSecret,
    });

    const response = await fetchImpl(`${credentials.baseUrl}/api/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: controller.signal,
    });

    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      throw new Error("Qikink authentication returned an invalid response.");
    }

    if (!response.ok) {
      throw new Error("Qikink authentication was rejected.");
    }

    const token = tokenFromResponse(parsed);
    if (!token) {
      throw new Error("Qikink authentication response did not contain an access token.");
    }

    const expiresIn = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? Number((parsed as QikinkTokenResponse).expires_in)
      : NaN;
    const lifetimeMs = Number.isFinite(expiresIn) && expiresIn > 60
      ? Math.max(60_000, (expiresIn - 60) * 1000)
      : 55 * 60 * 1000;

    cachedToken = token;
    cachedExpiry = Date.now() + lifetimeMs;
    return token;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Qikink authentication timed out.");
    }
    if (error instanceof Error) throw error;
    throw new Error("Qikink authentication failed.");
  } finally {
    clearTimeout(timer);
  }
}
