export type CustomerStatus = "ACTIVE" | "DISABLED" | "SUSPENDED" | "PENDING_VERIFICATION";

export type CustomerDto = {
  id: string;
  email: string;
  status: CustomerStatus;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerIdentityContext = {
  customerId: string;
};

export function toCustomerDto(customer: {
  id: string;
  email: string;
  status: CustomerStatus;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): CustomerDto {
  return {
    id: customer.id,
    email: customer.email,
    status: customer.status,
    emailVerifiedAt: customer.emailVerifiedAt?.toISOString() ?? null,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  };
}
