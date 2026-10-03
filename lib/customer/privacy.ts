import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";

export const PRIVACY_DELETE_CONFIRMATION = "DELETE MY ACCOUNT";
export const MAX_PRIVACY_EXPORT_RECORDS = 5000;

export type CustomerPrivacyExport = {
  exportVersion: 1;
  generatedAt: string;
  profile: {
    email: string;
    displayName: string | null;
    status: string;
    emailVerifiedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  addresses: Array<Record<string, unknown>>;
  orders: Array<Record<string, unknown>>;
  payments: Array<Record<string, unknown>>;
  returns: Array<Record<string, unknown>>;
  cancellations: Array<Record<string, unknown>>;
  cases: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
};

export class CustomerPrivacyError extends Error {
  constructor(
    public readonly code:
      | "CUSTOMER_NOT_FOUND"
      | "ADMIN_ACCOUNT_PROTECTED"
      | "CONFIRMATION_REQUIRED"
      | "EXPORT_TOO_LARGE"
      | "PRIVACY_DATABASE_ERROR",
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "CustomerPrivacyError";
  }
}

function iso(value: Date | null | undefined): string | null {
  return value?.toISOString() ?? null;
}

function decimal(value: Prisma.Decimal | null | undefined): string | null {
  return value?.toFixed(2) ?? null;
}

export function buildAnonymizedCustomerEmail(customerId: string): string {
  return `deleted+${customerId}@privacy.invalid`;
}

async function assertExportWithinBound(customerId: string, tx: Prisma.TransactionClient) {
  const [addresses, orders, payments, returns, cancellations, cases, notifications] = await Promise.all([
    tx.customerAddress.count({ where: { customerId } }),
    tx.order.count({ where: { customerId } }),
    tx.payment.count({ where: { customerId } }),
    tx.returnRequest.count({ where: { customerId } }),
    tx.cancellationRequest.count({ where: { customerId } }),
    tx.case.count({ where: { customerId } }),
    tx.notificationEvent.count({ where: { customerId } }),
  ]);

  const counts = { addresses, orders, payments, returns, cancellations, cases, notifications };
  if (Object.values(counts).some((count) => count > MAX_PRIVACY_EXPORT_RECORDS)) {
    throw new CustomerPrivacyError(
      "EXPORT_TOO_LARGE",
      "The customer export exceeds the safe bounded export size.",
    );
  }
  return counts;
}

async function buildExport(customerId: string, tx: Prisma.TransactionClient): Promise<CustomerPrivacyExport> {
  const customer = await tx.customer.findUnique({
    where: { id: customerId },
    select: {
      email: true,
      displayName: true,
      status: true,
      emailVerifiedAt: true,
      createdAt: true,
      updatedAt: true,
      anonymizedAt: true,
    },
  });
  if (!customer) throw new CustomerPrivacyError("CUSTOMER_NOT_FOUND", "Customer could not be found.");
  if (customer.anonymizedAt) {
    throw new CustomerPrivacyError("CUSTOMER_NOT_FOUND", "Customer could not be found.");
  }

  await assertExportWithinBound(customerId, tx);

  const [addresses, orders, payments, returns, cancellations, cases, notifications] = await Promise.all([
    tx.customerAddress.findMany({
      where: { customerId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
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
      },
    }),
    tx.order.findMany({
      where: { customerId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        orderNumber: true,
        status: true,
        subtotal: true,
        total: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
        shippingAddress: {
          select: {
            recipientName: true,
            phone: true,
            addressLine1: true,
            addressLine2: true,
            city: true,
            stateOrProvince: true,
            postalCode: true,
            countryCode: true,
            label: true,
          },
        },
        items: {
          orderBy: { createdAt: "asc" },
          select: {
            productTitleSnapshot: true,
            variantTitleSnapshot: true,
            skuSnapshot: true,
            selectedOptionsSnapshot: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
            currency: true,
          },
        },
        fulfillment: {
          select: { status: true },
        },
        shipments: {
          orderBy: { createdAt: "asc" },
          select: {
            shipmentReference: true,
            carrier: true,
            trackingNumber: true,
            trackingUrl: true,
            service: true,
            status: true,
            shippedAt: true,
            deliveredAt: true,
            trackingEvents: {
              orderBy: { eventTimestamp: "asc" },
              select: {
                providerStatus: true,
                normalizedStatus: true,
                eventTimestamp: true,
                location: true,
                description: true,
                source: true,
              },
            },
          },
        },
      },
    }),
    tx.payment.findMany({
      where: { customerId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        providerReference: true,
        status: true,
        amount: true,
        currency: true,
        completedAt: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
        refunds: {
          orderBy: { createdAt: "asc" },
          select: {
            amount: true,
            currency: true,
            status: true,
            reason: true,
            providerReference: true,
            createdAt: true,
            completedAt: true,
          },
        },
      },
    }),
    tx.returnRequest.findMany({
      where: { customerId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        returnReference: true,
        status: true,
        reasonCode: true,
        customerDescription: true,
        requestedAt: true,
        reviewedAt: true,
        resolvedAt: true,
        items: {
          select: {
            quantity: true,
            orderItem: {
              select: { productTitleSnapshot: true, variantTitleSnapshot: true, skuSnapshot: true },
            },
          },
        },
        shipment: {
          select: {
            reference: true,
            status: true,
            carrier: true,
            trackingNumber: true,
            trackingUrl: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        resolution: {
          select: {
            type: true,
            refundAmount: true,
            currency: true,
            resolvedAt: true,
          },
        },
      },
    }),
    tx.cancellationRequest.findMany({
      where: { customerId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        cancellationReference: true,
        status: true,
        reason: true,
        customerDescription: true,
        requestedAt: true,
        reviewedAt: true,
        completedAt: true,
      },
    }),
    tx.case.findMany({
      where: { customerId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        caseReference: true,
        category: true,
        status: true,
        title: true,
        customerDescription: true,
        createdAt: true,
        updatedAt: true,
        resolvedAt: true,
        closedAt: true,
        order: { select: { orderNumber: true } },
        shipment: { select: { shipmentReference: true } },
        returnRequest: { select: { returnReference: true } },
      },
    }),
    tx.notificationEvent.findMany({
      where: { customerId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        type: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    exportVersion: 1,
    generatedAt: new Date().toISOString(),
    profile: {
      email: customer.email,
      displayName: customer.displayName,
      status: customer.status,
      emailVerifiedAt: iso(customer.emailVerifiedAt),
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
    },
    addresses: addresses.map((address) => ({
      ...address,
      createdAt: address.createdAt.toISOString(),
      updatedAt: address.updatedAt.toISOString(),
    })),
    orders: orders.map((order) => ({
      orderNumber: order.orderNumber,
      status: order.status,
      subtotal: decimal(order.subtotal),
      total: decimal(order.total),
      currency: order.currency,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      shippingAddress: order.shippingAddress
        ? { ...order.shippingAddress }
        : null,
      items: order.items.map((item) => ({
        productTitle: item.productTitleSnapshot,
        variantTitle: item.variantTitleSnapshot,
        sku: item.skuSnapshot,
        selectedOptions: item.selectedOptionsSnapshot,
        quantity: item.quantity,
        unitPrice: decimal(item.unitPrice),
        lineTotal: decimal(item.lineTotal),
        currency: item.currency,
      })),
      fulfillmentStatus: order.fulfillment?.status ?? null,
      shipments: order.shipments.map((shipment) => ({
        reference: shipment.shipmentReference,
        carrier: shipment.carrier,
        trackingNumber: shipment.trackingNumber,
        trackingUrl: shipment.trackingUrl,
        service: shipment.service,
        status: shipment.status,
        shippedAt: iso(shipment.shippedAt),
        deliveredAt: iso(shipment.deliveredAt),
        trackingEvents: shipment.trackingEvents.map((event) => ({
          providerStatus: event.providerStatus,
          status: event.normalizedStatus,
          eventTimestamp: event.eventTimestamp.toISOString(),
          location: event.location,
          description: event.description,
          source: event.source,
        })),
      })),
    })),
    payments: payments.map((payment) => ({
      providerReference: payment.providerReference,
      status: payment.status,
      amount: decimal(payment.amount),
      currency: payment.currency,
      completedAt: iso(payment.completedAt),
      expiresAt: iso(payment.expiresAt),
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
      refunds: payment.refunds.map((refund) => ({
        amount: decimal(refund.amount),
        currency: refund.currency,
        status: refund.status,
        reason: refund.reason,
        providerReference: refund.providerReference,
        createdAt: refund.createdAt.toISOString(),
        completedAt: iso(refund.completedAt),
      })),
    })),
    returns: returns.map((request) => ({
      reference: request.returnReference,
      status: request.status,
      reasonCode: request.reasonCode,
      description: request.customerDescription,
      requestedAt: request.requestedAt.toISOString(),
      reviewedAt: iso(request.reviewedAt),
      resolvedAt: iso(request.resolvedAt),
      items: request.items.map((item) => ({
        quantity: item.quantity,
        productTitle: item.orderItem.productTitleSnapshot,
        variantTitle: item.orderItem.variantTitleSnapshot,
        sku: item.orderItem.skuSnapshot,
      })),
      shipment: request.shipment
        ? {
            reference: request.shipment.reference,
            status: request.shipment.status,
            carrier: request.shipment.carrier,
            trackingNumber: request.shipment.trackingNumber,
            trackingUrl: request.shipment.trackingUrl,
            createdAt: request.shipment.createdAt.toISOString(),
            updatedAt: request.shipment.updatedAt.toISOString(),
          }
        : null,
      resolution: request.resolution
        ? {
            type: request.resolution.type,
            refundAmount: decimal(request.resolution.refundAmount),
            currency: request.resolution.currency,
            resolvedAt: request.resolution.resolvedAt.toISOString(),
          }
        : null,
    })),
    cancellations: cancellations.map((request) => ({
      reference: request.cancellationReference,
      status: request.status,
      reason: request.reason,
      description: request.customerDescription,
      requestedAt: request.requestedAt.toISOString(),
      reviewedAt: iso(request.reviewedAt),
      completedAt: iso(request.completedAt),
    })),
    cases: cases.map((item) => ({
      reference: item.caseReference,
      category: item.category,
      status: item.status,
      title: item.title,
      description: item.customerDescription,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      resolvedAt: iso(item.resolvedAt),
      closedAt: iso(item.closedAt),
      orderReference: item.order?.orderNumber ?? null,
      shipmentReference: item.shipment?.shipmentReference ?? null,
      returnReference: item.returnRequest?.returnReference ?? null,
    })),
    notifications: notifications.map((event) => ({
      type: event.type,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

async function recordPrivacyAudit(
  tx: Prisma.TransactionClient,
  input: {
    customerId: string;
    operation: "EXPORT" | "DELETE";
    success: boolean;
    requestId?: string | null;
    reason?: string | null;
  },
) {
  await tx.adminAuditLog.create({
    data: {
      action: `CUSTOMER_PRIVACY_${input.operation}`,
      resourceType: "Customer",
      resourceId: input.customerId,
      success: input.success,
      reason: input.reason?.slice(0, 1000) ?? null,
      correlationId: input.requestId?.slice(0, 128) ?? null,
      metadata: {
        actorType: "CUSTOMER",
        actorCustomerId: input.customerId,
        operation: input.operation,
      },
    },
  });
}

export async function exportCustomerData(customerId: string, requestId?: string | null): Promise<CustomerPrivacyExport> {
  try {
    return await db.$transaction(async (tx) => {
      const result = await buildExport(customerId, tx);
      await recordPrivacyAudit(tx, {
        customerId,
        operation: "EXPORT",
        success: true,
        requestId,
        reason: "Customer-authorized data export",
      });
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof CustomerPrivacyError) throw error;
    throw new CustomerPrivacyError("PRIVACY_DATABASE_ERROR", "Customer privacy operation could not be completed safely.", { cause: error });
  }
}

export async function deleteCustomerData(
  customerId: string,
  confirmation: unknown,
  requestId?: string | null,
): Promise<{ anonymizedAt: string }> {
  if (confirmation !== PRIVACY_DELETE_CONFIRMATION) {
    throw new CustomerPrivacyError("CONFIRMATION_REQUIRED", "Explicit account deletion confirmation is required.");
  }

  try {
    return await db.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
        select: { id: true, anonymizedAt: true, status: true, adminUser: { select: { id: true } } },
      });
      if (!customer) throw new CustomerPrivacyError("CUSTOMER_NOT_FOUND", "Customer could not be found.");
      if (customer.adminUser) {
        throw new CustomerPrivacyError(
          "ADMIN_ACCOUNT_PROTECTED",
          "Administrative accounts require an administrative lifecycle workflow and cannot be deleted through the customer endpoint.",
        );
      }
      if (customer.anonymizedAt) {
        return { anonymizedAt: customer.anonymizedAt.toISOString() };
      }

      const anonymizedAt = new Date();

      await tx.customerCredential.deleteMany({ where: { customerId } });
      await tx.customerSession.deleteMany({ where: { customerId } });
      await tx.customerAddress.deleteMany({ where: { customerId } });

      const cart = await tx.cart.findUnique({ where: { customerId }, select: { id: true } });
      if (cart) await tx.cart.delete({ where: { id: cart.id } });

      await tx.case.updateMany({
        where: { customerId },
        data: { customerDescription: null },
      });
      await tx.case.updateMany({
        where: { customerId, source: "CUSTOMER" },
        data: { title: "Customer support request" },
      });
      await tx.notificationEvent.updateMany({
        where: { customerId },
        data: { payload: Prisma.DbNull },
      });
      await tx.paymentIdempotency.updateMany({
        where: { customerId },
        data: { response: Prisma.DbNull },
      });

      const updated = await tx.customer.updateMany({
        where: { id: customerId, anonymizedAt: null },
        data: {
          email: buildAnonymizedCustomerEmail(customerId),
          displayName: null,
          emailVerifiedAt: null,
          status: "DISABLED",
          anonymizedAt,
        },
      });
      if (updated.count !== 1) {
        const current = await tx.customer.findUnique({ where: { id: customerId }, select: { anonymizedAt: true } });
        if (current?.anonymizedAt) return { anonymizedAt: current.anonymizedAt.toISOString() };
        throw new CustomerPrivacyError("PRIVACY_DATABASE_ERROR", "Customer privacy operation could not be completed safely.");
      }

      await recordPrivacyAudit(tx, {
        customerId,
        operation: "DELETE",
        success: true,
        requestId,
        reason: "Customer-authorized deletion and anonymization",
      });

      return { anonymizedAt: anonymizedAt.toISOString() };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof CustomerPrivacyError) throw error;
    throw new CustomerPrivacyError("PRIVACY_DATABASE_ERROR", "Customer privacy operation could not be completed safely.", { cause: error });
  }
}
