import { CustomerIdentityError, CustomerAddressError } from "@/lib/customer/errors";

const EMAIL_MAX_LENGTH = 320;
const DISPLAY_NAME_MAX_LENGTH = 120;

export function normalizeCustomerEmail(email: string): string {
  if (typeof email !== "string") {
    throw new CustomerIdentityError("CUSTOMER_INVALID_EMAIL", "Customer email is invalid.");
  }
  const normalized = email.trim().toLowerCase();
  if (
    !normalized ||
    normalized.length > EMAIL_MAX_LENGTH ||
    /[\u0000-\u001F\u007F\\]/.test(normalized) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    throw new CustomerIdentityError("CUSTOMER_INVALID_EMAIL", "Customer email is invalid.");
  }
  return normalized;
}

export function validateDisplayName(value: unknown): string | null {
  if (value === undefined) return null;
  if (typeof value !== "string") {
    throw new CustomerIdentityError("CUSTOMER_INVALID_EMAIL", "Display name is invalid.");
  }
  const name = value.trim();
  if (name.length > DISPLAY_NAME_MAX_LENGTH || /[\u0000-\u001F\u007F]/.test(name)) {
    throw new CustomerIdentityError("CUSTOMER_INVALID_EMAIL", "Display name is invalid.");
  }
  return name || null;
}

const ADDRESS_LIMITS = {
  recipientName: 120,
  addressLine1: 200,
  addressLine2: 200,
  city: 100,
  stateOrProvince: 100,
  postalCode: 32,
  countryCode: 2,
  label: 40,
  phone: 32,
} as const;

function normalizeText(
  value: unknown,
  field: keyof typeof ADDRESS_LIMITS,
  required = true,
): string | null {
  if (typeof value !== "string") {
    if (!required && (value === undefined || value === null)) return null;
    throw new CustomerAddressError("CUSTOMER_ADDRESS_INVALID", "Address input is invalid.");
  }

  const normalized = value.trim().replace(/[ \t]+/g, " ");
  if (!normalized && !required) return null;
  if (
    !normalized ||
    normalized.length > ADDRESS_LIMITS[field] ||
    /[\u0000-\u001F\u007F]/.test(normalized)
  ) {
    throw new CustomerAddressError("CUSTOMER_ADDRESS_INVALID", "Address input is invalid.");
  }
  return normalized;
}

export function validateCustomerAddressInput(input: Record<string, unknown>) {
  const recipientName = normalizeText(input.recipientName, "recipientName");
  const addressLine1 = normalizeText(input.addressLine1, "addressLine1");
  const addressLine2 = normalizeText(input.addressLine2, "addressLine2", false);
  const city = normalizeText(input.city, "city");
  const stateOrProvince = normalizeText(input.stateOrProvince, "stateOrProvince");
  const postalCode = normalizeText(input.postalCode, "postalCode");
  const label = normalizeText(input.label, "label");
  const countryRaw = normalizeText(input.countryCode, "countryCode");
  const phone = normalizeText(input.phone, "phone", false);

  const countryCode = countryRaw!.toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    throw new CustomerAddressError("CUSTOMER_ADDRESS_INVALID", "Country code is invalid.");
  }

  if (!/[A-Za-z0-9]/.test(postalCode!)) {
    throw new CustomerAddressError("CUSTOMER_ADDRESS_INVALID", "Postal code is invalid.");
  }

  if (phone !== null && !/^[+0-9().\-\s]{7,32}$/.test(phone)) {
    throw new CustomerAddressError("CUSTOMER_ADDRESS_INVALID", "Phone number is invalid.");
  }

  if (input.isDefault !== undefined && typeof input.isDefault !== "boolean") {
    throw new CustomerAddressError("CUSTOMER_ADDRESS_INVALID", "Default-address value is invalid.");
  }

  return {
    recipientName: recipientName!,
    phone,
    addressLine1: addressLine1!,
    addressLine2,
    city: city!,
    stateOrProvince: stateOrProvince!,
    postalCode: postalCode!,
    countryCode,
    label: label!,
    isDefault: input.isDefault === true,
  };
}
