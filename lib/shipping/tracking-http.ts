import { NextResponse } from "next/server";
import { AuthenticationError, isAuthenticationError } from "@/lib/auth/errors";
import { ShippingDomainError } from "@/lib/shipping/errors";

export function trackingJson<T>(data: T, init: ResponseInit = {}) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      "cache-control": "private, no-store, max-age=0",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow, noarchive",
      ...(init.headers ?? {}),
    },
  });
}

export function trackingErrorResponse(error: unknown) {
  if (isAuthenticationError(error)) {
    return trackingJson(
      { error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication is required." } },
      { status: 401 },
    );
  }

  if (error instanceof ShippingDomainError) {
    if (
      error.code === "SHIPMENT_NOT_FOUND"
      || error.code === "UNAUTHORIZED_SHIPMENT_ACCESS"
      || error.code === "INVALID_TRACKING_EVENT"
    ) {
      return trackingJson(
        { error: { code: "TRACKING_NOT_FOUND", message: "Tracking information could not be found." } },
        { status: 404 },
      );
    }

    return trackingJson(
      { error: { code: "TRACKING_UNAVAILABLE", message: "Tracking information is temporarily unavailable." } },
      { status: 503 },
    );
  }

  return trackingJson(
    { error: { code: "TRACKING_UNAVAILABLE", message: "Tracking information is temporarily unavailable." } },
    { status: 503 },
  );
}

export function trackingMethodNotAllowed() {
  return trackingJson(
    { error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." } },
    { status: 405, headers: { allow: "GET" } },
  );
}
