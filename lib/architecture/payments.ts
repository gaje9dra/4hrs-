export type PaymentProviderId = 'razorpay' | 'payu' | 'stripe' | 'other'

export interface PaymentAdapter {
  id: PaymentProviderId
  createPayment: (request: unknown) => Promise<unknown>
  verifyPayment: (request: unknown) => Promise<boolean>
  refundPayment?: (request: unknown) => Promise<unknown>
}

export const paymentAdapters: Partial<Record<PaymentProviderId, PaymentAdapter>> = {}