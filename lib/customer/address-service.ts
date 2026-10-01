import { Prisma } from "@prisma/client";
import {
  createCustomerAddressRepository,
  type CustomerAddressRepository,
} from "@/lib/customer/address-repository";
import { CustomerAddressError } from "@/lib/customer/errors";
import { toCustomerAddressDto, type CustomerAddressDto } from "@/lib/customer/contracts";
import { validateCustomerAddressInput } from "@/lib/customer/validation";

function mapAddressPersistenceError(error: unknown): never {
  if (error instanceof CustomerAddressError) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new CustomerAddressError("CUSTOMER_ADDRESS_DATABASE_ERROR", "Address persistence could not complete.", { cause: error });
    }
    if (error.code === "P2025") {
      throw new CustomerAddressError("CUSTOMER_ADDRESS_NOT_FOUND", "Address was not found.", { cause: error });
    }
  }
  if (error instanceof Error && error.message === "CUSTOMER_ADDRESS_NOT_FOUND") {
    throw new CustomerAddressError("CUSTOMER_ADDRESS_NOT_FOUND", "Address was not found.");
  }
  throw new CustomerAddressError("CUSTOMER_ADDRESS_DATABASE_ERROR", "Address persistence operation failed.", { cause: error });
}

function assertCustomerId(customerId: string) {
  if (typeof customerId !== "string" || !customerId.trim()) {
    throw new CustomerAddressError("CUSTOMER_ADDRESS_INVALID", "Customer identity is invalid.");
  }
}

function validateInput(input: Record<string, unknown>) {
  try {
    return validateCustomerAddressInput(input);
  } catch (error) {
    mapAddressPersistenceError(error);
  }
}

export function createCustomerAddressService(
  dependencies: { repository?: CustomerAddressRepository } = {},
) {
  const repository = dependencies.repository ?? createCustomerAddressRepository();

  async function listAddresses(customerId: string): Promise<CustomerAddressDto[]> {
    assertCustomerId(customerId);
    try {
      return (await repository.findCustomerAddresses(customerId)).map(toCustomerAddressDto);
    } catch (error) {
      mapAddressPersistenceError(error);
    }
  }

  async function getAddress(customerId: string, addressId: string): Promise<CustomerAddressDto> {
    assertCustomerId(customerId);
    try {
      const address = await repository.findCustomerAddress(customerId, addressId);
      if (!address) throw new CustomerAddressError("CUSTOMER_ADDRESS_NOT_FOUND", "Address was not found.");
      return toCustomerAddressDto(address);
    } catch (error) {
      mapAddressPersistenceError(error);
    }
  }

  async function createAddress(customerId: string, input: Record<string, unknown>): Promise<CustomerAddressDto> {
    assertCustomerId(customerId);
    const normalized = validateInput(input);

    try {
      const address = await repository.withTransaction(async (tx) => {
        const count = await tx.countCustomerAddresses(customerId);
        const shouldDefault = normalized.isDefault || count === 0;
        if (shouldDefault) await tx.clearCustomerDefaultAddress(customerId);

        return tx.createCustomerAddress({
          customerId,
          recipientName: normalized.recipientName,
          phone: normalized.phone,
          addressLine1: normalized.addressLine1,
          addressLine2: normalized.addressLine2,
          city: normalized.city,
          stateOrProvince: normalized.stateOrProvince,
          postalCode: normalized.postalCode,
          countryCode: normalized.countryCode,
          label: normalized.label,
          isDefault: shouldDefault,
        });
      });

      return toCustomerAddressDto(address);
    } catch (error) {
      mapAddressPersistenceError(error);
    }
  }

  async function updateAddress(
    customerId: string,
    addressId: string,
    input: Record<string, unknown>,
  ): Promise<CustomerAddressDto> {
    assertCustomerId(customerId);
    const normalized = validateInput({ ...input, isDefault: false });

    try {
      const address = await repository.updateCustomerAddress(customerId, addressId, {
        recipientName: normalized.recipientName,
        phone: normalized.phone,
        addressLine1: normalized.addressLine1,
        addressLine2: normalized.addressLine2,
        city: normalized.city,
        stateOrProvince: normalized.stateOrProvince,
        postalCode: normalized.postalCode,
        countryCode: normalized.countryCode,
        label: normalized.label,
      });
      return toCustomerAddressDto(address);
    } catch (error) {
      mapAddressPersistenceError(error);
    }
  }

  async function deleteAddress(customerId: string, addressId: string): Promise<void> {
    assertCustomerId(customerId);

    try {
      await repository.withTransaction(async (tx) => {
        const existing = await tx.findCustomerAddress(customerId, addressId);
        if (!existing) throw new CustomerAddressError("CUSTOMER_ADDRESS_NOT_FOUND", "Address was not found.");

        await tx.deleteCustomerAddress(customerId, addressId);

        if (existing.isDefault) {
          const candidate = await tx.findNextDefaultCandidate(customerId);
          if (candidate) await tx.markAddressDefault(candidate.id);
        }
      });
    } catch (error) {
      mapAddressPersistenceError(error);
    }
  }

  async function setDefaultAddress(customerId: string, addressId: string): Promise<CustomerAddressDto> {
    assertCustomerId(customerId);

    try {
      const address = await repository.withTransaction((tx) =>
        tx.setCustomerDefaultAddress(customerId, addressId),
      );
      if (!address) throw new CustomerAddressError("CUSTOMER_ADDRESS_NOT_FOUND", "Address was not found.");
      return toCustomerAddressDto(address);
    } catch (error) {
      mapAddressPersistenceError(error);
    }
  }

  return { listAddresses, getAddress, createAddress, updateAddress, deleteAddress, setDefaultAddress };
}

export type CustomerAddressService = ReturnType<typeof createCustomerAddressService>;
