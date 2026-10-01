import type {PaymentProviderAdapter,PaymentProviderRegistry,PaymentProviderResolver} from "@/lib/payments/provider";
import {assertPrivatePaymentConfiguration,loadPaymentProviderConfiguration,type PaymentProviderConfiguration} from "@/lib/payments/config";
export type PaymentProviderResolverDependencies={registry:PaymentProviderRegistry;configuration?:PaymentProviderConfiguration|null};
export function createPaymentProviderResolver(dependencies:PaymentProviderResolverDependencies):PaymentProviderResolver{
 const configuration=dependencies.configuration===undefined?loadPaymentProviderConfiguration():dependencies.configuration;
 if(configuration)assertPrivatePaymentConfiguration(configuration);
 return {resolve(context){
  if(!configuration||!configuration.enabled)return undefined;
  if(context.providerId&&context.providerId!==configuration.id)return undefined;
  return dependencies.registry.get(configuration.id);
 }};
}
export function createPaymentProviderRegistry(adapters:readonly PaymentProviderAdapter[]):PaymentProviderRegistry{
 const map=new Map<string,PaymentProviderAdapter>();
 for(const adapter of adapters){const id=adapter.id.trim().toLowerCase();if(!id||map.has(id))throw new Error("Duplicate payment provider adapter.");map.set(id,adapter);}
 return {get(providerId){return map.get(providerId.trim().toLowerCase())}};
}
export function assertSupportedProvider(registry:PaymentProviderRegistry,providerId:string):PaymentProviderAdapter{
 const adapter=registry.get(providerId);if(!adapter)throw new Error("Payment provider is unsupported.");return adapter;
}
