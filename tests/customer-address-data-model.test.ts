import assert from "node:assert/strict";
import test from "node:test";
import { CustomerAddressError } from "../lib/customer/errors.ts";
import { validateCustomerAddressInput } from "../lib/customer/validation.ts";
import { createCustomerAddressService } from "../lib/customer/address-service.ts";
import type {
  CustomerAddressRecord,
  CustomerAddressRepository,
} from "../lib/customer/address-repository.ts";

function address(overrides: Partial<CustomerAddressRecord> = {}): CustomerAddressRecord {
  return {
    id: "address-1",
    customerId: "customer-a",
    recipientName: "Jane Doe",
    phone: "+919999999999",
    addressLine1: "12 Main Road",
    addressLine2: null,
    city: "Jaipur",
    stateOrProvince: "Rajasthan",
    postalCode: "302001",
    countryCode: "IN",
    label: "Home",
    isDefault: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function fakeRepository(initial: CustomerAddressRecord[] = []): CustomerAddressRepository {
  const rows = [...initial];

  return {
    async withTransaction<T>(work: (repository: CustomerAddressRepository) => Promise<T>) {
      return work(this);
    },
    async countCustomerAddresses(customerId) {
      return rows.filter((row) => row.customerId === customerId).length;
    },
    async findCustomerAddresses(customerId) {
      return rows
        .filter((row) => row.customerId === customerId)
        .sort((a, b) =>
          Number(b.isDefault) - Number(a.isDefault) ||
          b.createdAt.getTime() - a.createdAt.getTime() ||
          b.id.localeCompare(a.id),
        );
    },
    async findCustomerAddress(customerId, addressId) {
      return rows.find((row) => row.customerId === customerId && row.id === addressId) ?? null;
    },
    async createCustomerAddress(input) {
      const created = address({
        ...input,
        id: "address-" + (rows.length + 1),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      rows.push(created);
      return created;
    },
    async updateCustomerAddress(customerId, addressId, input) {
      const row = rows.find((item) => item.customerId === customerId && item.id === addressId);
      if (!row) throw new Error("CUSTOMER_ADDRESS_NOT_FOUND");
      Object.assign(row, input, { updatedAt: new Date() });
      return row;
    },
    async deleteCustomerAddress(customerId, addressId) {
      const index = rows.findIndex((row) => row.customerId === customerId && row.id === addressId);
      if (index < 0) return null;
      return rows.splice(index, 1)[0];
    },
    async clearCustomerDefaultAddress(customerId) {
      for (const row of rows) {
        if (row.customerId === customerId) row.isDefault = false;
      }
    },
    async setCustomerDefaultAddress(customerId, addressId) {
      const row = rows.find((item) => item.customerId === customerId && item.id === addressId);
      if (!row) return null;
      for (const item of rows) {
        if (item.customerId === customerId) item.isDefault = false;
      }
      row.isDefault = true;
      return row;
    },
    async findNextDefaultCandidate(customerId) {
      return (await this.findCustomerAddresses(customerId))[0] ?? null;
    },
    async markAddressDefault(addressId) {
      const row = rows.find((item) => item.id === addressId);
      if (!row) throw new Error("CUSTOMER_ADDRESS_NOT_FOUND");
      row.isDefault = true;
      return row;
    },
  };
}

const validInput = {
  recipientName: "Jane Doe",
  phone: "+919999999999",
  addressLine1: "12 Main Road",
  addressLine2: "Near Market",
  city: "Jaipur",
  stateOrProvince: "Rajasthan",
  postalCode: "302001",
  countryCode: "in",
  label: "Home",
};

test("address validation normalizes whitespace and country code", () => {
  const result = validateCustomerAddressInput({
    ...validInput,
    recipientName: "  Jane   Doe  ",
    countryCode: " in ",
  });
  assert.equal(result.recipientName, "Jane Doe");
  assert.equal(result.countryCode, "IN");
});

test("address validation rejects missing required fields and malformed country code", () => {
  assert.throws(
    () => validateCustomerAddressInput({ ...validInput, city: "" }),
    (error: unknown) => error instanceof CustomerAddressError && error.code === "CUSTOMER_ADDRESS_INVALID",
  );
  assert.throws(
    () => validateCustomerAddressInput({ ...validInput, countryCode: "IND" }),
    (error: unknown) =>
      error instanceof CustomerAddressError &&
      error.code === "CUSTOMER_ADDRESS_INVALID",
  );
});

test("address validation rejects oversized and unsafe values", () => {
  assert.throws(
    () => validateCustomerAddressInput({ ...validInput, addressLine1: "x".repeat(201) }),
    /Address input is invalid/,
  );
  assert.throws(
    () => validateCustomerAddressInput({ ...validInput, city: "Jaipur\u0000" }),
    /Address input is invalid/,
  );
});

test("address validation accepts optional empty values as null", () => {
  const result = validateCustomerAddressInput({
    ...validInput,
    phone: " ",
    addressLine2: "",
  });
  assert.equal(result.phone, null);
  assert.equal(result.addressLine2, null);
});

test("customer address reads are ownership-scoped", async () => {
  const repository = fakeRepository([address()]);
  const service = createCustomerAddressService({ repository });

  await assert.rejects(
    service.getAddress("customer-b", "address-1"),
    (error: unknown) => error instanceof CustomerAddressError && error.code === "CUSTOMER_ADDRESS_NOT_FOUND",
  );
});

test("first address becomes default and different customers keep independent defaults", async () => {
  const repository = fakeRepository([
    address({ id: "address-b", customerId: "customer-b" }),
  ]);
  const service = createCustomerAddressService({ repository });

  await service.createAddress("customer-a", validInput);
  const customerA = await service.listAddresses("customer-a");
  const customerB = await service.listAddresses("customer-b");

  assert.equal(customerA.filter((item) => item.isDefault).length, 1);
  assert.equal(customerB.filter((item) => item.isDefault).length, 1);
});

test("setting a default replaces only the same customer's default", async () => {
  const repository = fakeRepository([
    address({ id: "a-1", customerId: "customer-a", isDefault: true }),
    address({ id: "a-2", customerId: "customer-a", isDefault: false }),
    address({ id: "b-1", customerId: "customer-b", isDefault: true }),
  ]);
  const service = createCustomerAddressService({ repository });

  await service.setDefaultAddress("customer-a", "a-2");
  const customerA = await service.listAddresses("customer-a");
  const customerB = await service.listAddresses("customer-b");

  assert.deepEqual(customerA.filter((item) => item.isDefault).map((item) => item.id), ["a-2"]);
  assert.deepEqual(customerB.filter((item) => item.isDefault).map((item) => item.id), ["b-1"]);
});

test("deleting a default promotes the deterministic next address", async () => {
  const repository = fakeRepository([
    address({ id: "a-1", customerId: "customer-a", isDefault: true, createdAt: new Date("2026-01-01") }),
    address({ id: "a-2", customerId: "customer-a", isDefault: false, createdAt: new Date("2026-02-01") }),
  ]);
  const service = createCustomerAddressService({ repository });

  await service.deleteAddress("customer-a", "a-1");
  const remaining = await service.listAddresses("customer-a");

  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, "a-2");
  assert.equal(remaining[0].isDefault, true);
});

test("address DTO does not expose customer ownership or persistence internals", async () => {
  const service = createCustomerAddressService({ repository: fakeRepository([address()]) });
  const result = await service.getAddress("customer-a", "address-1");

  assert.equal("customerId" in result, false);
  assert.equal("passwordHash" in result, false);
  assert.equal("sessionTokenHash" in result, false);
});
