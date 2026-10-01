import { requireCurrentCustomer } from "@/lib/auth/context";
import { isAuthenticationError } from "@/lib/auth/errors";
import { assertSameOrigin, authJson } from "@/lib/auth/http";
import { CustomerAddressError } from "@/lib/customer/errors";
import { createCustomerAddressService } from "@/lib/customer/address-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const addresses = createCustomerAddressService();

function errorResponse(error: unknown) {
  if (isAuthenticationError(error)) {
    return authJson({ error: { code: error.code, message: error.publicMessage } }, { status: 401 });
  }
  if (error instanceof CustomerAddressError) {
    const status =
      error.code === "CUSTOMER_ADDRESS_NOT_FOUND" ? 404 :
      error.code === "CUSTOMER_ADDRESS_DATABASE_ERROR" ? 503 : 400;
    return authJson({ error: { code: error.code, message: error.message } }, { status });
  }
  return authJson(
    { error: { code: "CUSTOMER_ADDRESS_DATABASE_ERROR", message: "Address information is temporarily unavailable." } },
    { status: 503 },
  );
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > 16 * 1024) {
    throw new CustomerAddressError("CUSTOMER_ADDRESS_INVALID", "Address request is invalid.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new CustomerAddressError("CUSTOMER_ADDRESS_INVALID", "Address request is invalid.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new CustomerAddressError("CUSTOMER_ADDRESS_INVALID", "Address request is invalid.");
  }
  return body as Record<string, unknown>;
}

function assertAllowedFields(body: Record<string, unknown>) {
  const allowed = new Set([
    "recipientName",
    "phone",
    "addressLine1",
    "addressLine2",
    "city",
    "stateOrProvince",
    "postalCode",
    "countryCode",
    "label",
  ]);
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    throw new CustomerAddressError(
      "CUSTOMER_ADDRESS_INVALID",
      "Address update contains an unsupported field.",
    );
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ addressId: string }> },
) {
  try {
    const current = await requireCurrentCustomer();
    const { addressId } = await context.params;
    return authJson({ address: await addresses.getAddress(current.customer.id, addressId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ addressId: string }> },
) {
  try {
    assertSameOrigin(request);
    const current = await requireCurrentCustomer(request);
    const { addressId } = await context.params;
    const body = await readBody(request);
    assertAllowedFields(body);
    return authJson({ address: await addresses.updateAddress(current.customer.id, addressId, body) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ addressId: string }> },
) {
  try {
    assertSameOrigin(request);
    const current = await requireCurrentCustomer(request);
    const { addressId } = await context.params;
    await addresses.deleteAddress(current.customer.id, addressId);
    return new Response(null, {
      status: 204,
      headers: { "cache-control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ addressId: string }> },
) {
  try {
    assertSameOrigin(request);
    const current = await requireCurrentCustomer(request);
    const { addressId } = await context.params;
    const body = await readBody(request);
    if (Object.keys(body).length !== 0) {
      throw new CustomerAddressError(
        "CUSTOMER_ADDRESS_INVALID",
        "Default-address request must not contain a body.",
      );
    }
    return authJson({ address: await addresses.setDefaultAddress(current.customer.id, addressId) });
  } catch (error) {
    return errorResponse(error);
  }
}
