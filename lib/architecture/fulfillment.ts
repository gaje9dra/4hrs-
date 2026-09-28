export type FulfillmentProviderId = 'qikink' | 'printrove' | 'printful' | 'printify' | 'manual' | 'inventory'

export interface FulfillmentProvider {
  id: FulfillmentProviderId
  name: string
  createFulfillment: (request: unknown) => Promise<unknown>
  getFulfillment: (id: string) => Promise<unknown>
  cancelFulfillment?: (id: string) => Promise<unknown>
}

export const fulfillmentProviders: Partial<Record<FulfillmentProviderId, FulfillmentProvider>> = {}