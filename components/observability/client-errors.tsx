"use client";

import { useEffect } from "react";
import { sendClientError } from "@/lib/observability/client";

export function ClientErrorTelemetry() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => sendClientError("runtime", event.message || "Client runtime error");
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason.message : typeof event.reason === "string" ? event.reason : "Unhandled promise rejection";
      sendClientError("unhandledrejection", reason);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
