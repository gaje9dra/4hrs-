import { Prisma } from "@prisma/client";

export type CustomerStatus = "ACTIVE" | "DISABLED" | "SUSPENDED" | "PENDING_VERIFICATION";
export type CustomerStatusTransition =
  | { from: "ACTIVE"; to: "DISABLED" | "SUSPENDED" }
  | { from: "DISABLED" | "SUSPENDED"; to: "ACTIVE" };

export function assertCustomerStatusTransition(from: CustomerStatus, to: CustomerStatus): void {
  if (from === to) return;
  if (from === "ACTIVE" && (to === "DISABLED" || to === "SUSPENDED")) return;
  if ((from === "DISABLED" || from === "SUSPENDED") && to === "ACTIVE") return;
  if (from === "PENDING_VERIFICATION" || to === "PENDING_VERIFICATION") {
    throw new Error("Pending verification status must remain owned by the verification workflow.");
  }
  throw new Error("Unsupported customer status transition.");
}

export function normalizeCustomerDisplayName(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("Customer display name is invalid.");
  const normalized = value.trim();
  if (normalized.length > 120) throw new Error("Customer display name is too long.");
  return normalized || null;
}

export const CUSTOMER_STATUS_VALUES = ["ACTIVE","DISABLED","SUSPENDED","PENDING_VERIFICATION"] as const;
export const CUSTOMER_SORT_VALUES = ["createdAt","updatedAt","displayName","email","orderCount","grossPurchaseValue"] as const;
export type CustomerSort = typeof CUSTOMER_SORT_VALUES[number];

export function parseCustomerStatus(value: unknown): CustomerStatus | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !(CUSTOMER_STATUS_VALUES as readonly string[]).includes(value)) {
    throw new Error("Customer status filter is invalid.");
  }
  return value as CustomerStatus;
}
export function parseCustomerSort(value: unknown): CustomerSort {
  if (value === undefined || value === null || value === "") return "createdAt";
  if (typeof value !== "string" || !(CUSTOMER_SORT_VALUES as readonly string[]).includes(value)) throw new Error("Customer sort is invalid.");
  return value as CustomerSort;
}
export function parseSortDirection(value: unknown): "asc" | "desc" {
  if (value === undefined || value === null || value === "") return "desc";
  if (value !== "asc" && value !== "desc") throw new Error("Customer sort direction is invalid.");
  return value;
}
export function isPaidPaymentStatus(status: string): boolean {
  return ["SUCCEEDED","REFUNDED","PARTIALLY_REFUNDED"].includes(status);
}
export function decimalToString(value: Prisma.Decimal | null | undefined): string | null {
  return value === null || value === undefined ? null : value.toFixed(2);
}
