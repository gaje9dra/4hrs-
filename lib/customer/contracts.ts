export type CustomerStatus = "ACTIVE" | "DISABLED" | "SUSPENDED" | "PENDING_VERIFICATION";

export type CustomerDto = {
  id: string;
  email: string;
  displayName?: string | null;
  status: CustomerStatus;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerIdentityContext = {
  customerId: string;
};

export type CustomerAddressDto = {
  id: string;
  recipientName: string;
  phone: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  stateOrProvince: string;
  postalCode: string;
  countryCode: string;
  label: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CustomerAddressInput = {
  recipientName: string;
  phone?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  stateOrProvince: string;
  postalCode: string;
  countryCode: string;
  label: string;
  isDefault?: boolean;
};

export function toCustomerDto(customer: {
  id: string;
  email: string;
  status: CustomerStatus;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  displayName?: string | null;
}): CustomerDto {
  return {
    id: customer.id,
    email: customer.email,
    displayName: customer.displayName ?? null,
    status: customer.status,
    emailVerifiedAt: customer.emailVerifiedAt?.toISOString() ?? null,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  };
}

export function toCustomerAddressDto(address: {
  id: string;
  recipientName: string;
  phone: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  stateOrProvince: string;
  postalCode: string;
  countryCode: string;
  label: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}): CustomerAddressDto {
  return {
    id: address.id,
    recipientName: address.recipientName,
    phone: address.phone,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.city,
    stateOrProvince: address.stateOrProvince,
    postalCode: address.postalCode,
    countryCode: address.countryCode,
    label: address.label,
    isDefault: address.isDefault,
    createdAt: address.createdAt.toISOString(),
    updatedAt: address.updatedAt.toISOString(),
  };
}
