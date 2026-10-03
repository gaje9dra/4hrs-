import { authJson, readAuthJson } from "@/lib/auth/http";
import { CommunicationPreferenceError } from "@/lib/communications/preferences";
import { consumeUnsubscribeToken } from "@/lib/communications/unsubscribe";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function errorResponse(error: unknown) {
  const status = error instanceof CommunicationPreferenceError && error.code === "CUSTOMER_NOT_FOUND" ? 404 : 400;
  return authJson({ error: { code: error instanceof CommunicationPreferenceError ? error.code : "UNSUBSCRIBE_FAILED", message: error instanceof CommunicationPreferenceError ? error.message : "The unsubscribe request could not be completed." } }, { status });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return errorResponse(new CommunicationPreferenceError("PREFERENCE_DATABASE_ERROR", "The unsubscribe link is invalid or expired."));
  return authJson({ valid: true, action: "unsubscribe", tokenRequiredForMutation: true });
}

export async function POST(request: Request) {
  try {
    const body = await readAuthJson(request);
    if (Object.keys(body).some((key) => key !== "token")) throw new CommunicationPreferenceError("PREFERENCE_DATABASE_ERROR", "The unsubscribe request is invalid.");
    const result = await consumeUnsubscribeToken(body.token, request.headers.get("x-request-id"));
    return authJson({ unsubscribe: result });
  } catch (error) { return errorResponse(error); }
}
