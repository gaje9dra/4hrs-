export type ShippingProviderId = 'shiprocket' | 'delhivery' | 'dtdc' | 'blue-dart' | 'native' | 'manual'

export interface ShippingAdapter {
  id: ShippingProviderId
  createShipment: (request: unknown) => Promise<unknown>
  trackShipment: (trackingId: string) => Promise<unknown>
}

export const shippingAdapters: Partial<Record<ShippingProviderId, ShippingAdapter>> = {}