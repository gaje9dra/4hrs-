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

export async function GET() {
  try {
    const current = await requireCurrentCustomer();
    return authJson({ addresses: await addresses.listAddresses(current.customer.id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const current = await requireCurrentCustomer(request);
    const body = await readBody(request);
    return authJson(
      { address: await addresses.createAddress(current.customer.id, body) },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
