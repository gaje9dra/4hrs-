import { Prisma, type PrismaClient } from "@prisma/client";
import { db } from "@/lib/db/client";

export type CustomerAddressRepositoryClient = PrismaClient | Prisma.TransactionClient;

export type CustomerAddressRecord = {
  id: string;
  customerId: string;
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
};

const addressSelect = {
  id: true,
  customerId: true,
  recipientName: true,
  phone: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  stateOrProvince: true,
  postalCode: true,
  countryCode: true,
  label: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CustomerAddressSelect;

type AddressPersistenceInput = {
  customerId: string;
  recipientName: string;
  phone?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  stateOrProvince: string;
  postalCode: string;
  countryCode: string;
  label: string;
  isDefault: boolean;
};

function clientOrDefault(client?: CustomerAddressRepositoryClient): CustomerAddressRepositoryClient {
  return client ?? db;
}

export type CustomerAddressRepository = {
  withTransaction<T>(work: (repository: CustomerAddressRepository) => Promise<T>): Promise<T>;
  countCustomerAddresses(customerId: string): Promise<number>;
  findCustomerAddresses(customerId: string): Promise<CustomerAddressRecord[]>;
  findCustomerAddress(customerId: string, addressId: string): Promise<CustomerAddressRecord | null>;
  createCustomerAddress(input: AddressPersistenceInput): Promise<CustomerAddressRecord>;
  updateCustomerAddress(
    customerId: string,
    addressId: string,
    input: Omit<AddressPersistenceInput, "customerId" | "isDefault">,
  ): Promise<CustomerAddressRecord>;
  deleteCustomerAddress(customerId: string, addressId: string): Promise<CustomerAddressRecord | null>;
  clearCustomerDefaultAddress(customerId: string): Promise<void>;
  setCustomerDefaultAddress(customerId: string, addressId: string): Promise<CustomerAddressRecord | null>;
  findNextDefaultCandidate(customerId: string): Promise<CustomerAddressRecord | null>;
  markAddressDefault(addressId: string): Promise<CustomerAddressRecord>;
};

export function createCustomerAddressRepository(client?: CustomerAddressRepositoryClient): CustomerAddressRepository {
  const database = clientOrDefault(client);

  return {
    withTransaction<T>(work: (repository: CustomerAddressRepository) => Promise<T>) {
      if ("$transaction" in database) {
        return database.$transaction((tx) => work(createCustomerAddressRepository(tx)), {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      }
      return work(createCustomerAddressRepository(database));
    },

    countCustomerAddresses(customerId) {
      return database.customerAddress.count({ where: { customerId } });
    },

    async findCustomerAddresses(customerId) {
      return database.customerAddress.findMany({
        where: { customerId },
        select: addressSelect,
        orderBy: [
          { isDefault: "desc" },
          { createdAt: "desc" },
          { id: "desc" },
        ],
      });
    },

    async findCustomerAddress(customerId, addressId) {
      return database.customerAddress.findFirst({
        where: { id: addressId, customerId },
        select: addressSelect,
      });
    },

    async createCustomerAddress(input) {
      return database.customerAddress.create({
        data: {
          customerId: input.customerId,
          recipientName: input.recipientName,
          phone: input.phone ?? null,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2 ?? null,
          city: input.city,
          stateOrProvince: input.stateOrProvince,
          postalCode: input.postalCode,
          countryCode: input.countryCode,
          label: input.label,
          isDefault: input.isDefault,
        },
        select: addressSelect,
      });
    },

    async updateCustomerAddress(customerId, addressId, input) {
      const result = await database.customerAddress.updateMany({
        where: { id: addressId, customerId },
        data: {
          recipientName: input.recipientName,
          phone: input.phone ?? null,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2 ?? null,
          city: input.city,
          stateOrProvince: input.stateOrProvince,
          postalCode: input.postalCode,
          countryCode: input.countryCode,
          label: input.label,
        },
      });
      if (result.count !== 1) {
        throw new Error("CUSTOMER_ADDRESS_NOT_FOUND");
      }

      const updated = await database.customerAddress.findFirst({
        where: { id: addressId, customerId },
        select: addressSelect,
      });
      if (!updated) {
        throw new Error("CUSTOMER_ADDRESS_NOT_FOUND");
      }
      return updated;
    },

    async deleteCustomerAddress(customerId, addressId) {
      const existing = await database.customerAddress.findFirst({
        where: { id: addressId, customerId },
        select: addressSelect,
      });
      if (!existing) return null;
      await database.customerAddress.delete({ where: { id: addressId } });
      return existing;
    },

    async clearCustomerDefaultAddress(customerId) {
      await database.customerAddress.updateMany({
        where: { customerId, isDefault: true },
        data: { isDefault: false },
      });
    },

    async setCustomerDefaultAddress(customerId, addressId) {
      const owned = await database.customerAddress.findFirst({
        where: { id: addressId, customerId },
        select: { id: true },
      });
      if (!owned) return null;

      await database.customerAddress.updateMany({
        where: { customerId, isDefault: true },
        data: { isDefault: false },
      });

      return database.customerAddress.update({
        where: { id: addressId },
        data: { isDefault: true },
        select: addressSelect,
      });
    },

    findNextDefaultCandidate(customerId) {
      return database.customerAddress.findFirst({
        where: { customerId },
        select: addressSelect,
        orderBy: [
          { createdAt: "desc" },
          { id: "desc" },
        ],
      });
    },

    markAddressDefault(addressId) {
      return database.customerAddress.update({
        where: { id: addressId },
        data: { isDefault: true },
        select: addressSelect,
      });
    },
  };
}
