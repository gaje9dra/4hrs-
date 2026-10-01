const PROVIDER_ID_PATTERN=/^[a-z0-9][a-z0-9._-]{0,63}$/;
export type PaymentProviderConfiguration={
 id:string; enabled:boolean; mode:"test"|"live"; publicKey:string|null;
 secretReference:string|null; webhookSecretReference:string|null; timeoutMs:number;
 capabilities:Readonly<Record<string,boolean>>;
};
export type PaymentProviderConfigurationSource={
 providerId?:string; enabled?:string; mode?:string; publicKey?:string;
 secretReference?:string; webhookSecretReference?:string; timeoutMs?:string;
};
function bool(v:string|undefined,fallback:boolean){return v===undefined?fallback:/^(1|true)$/i.test(v)}
function mode(v:string|undefined):"test"|"live"{return v==="live"?"live":"test"}
function timeout(v:string|undefined){const n=v===undefined?10000:Number(v);return Number.isSafeInteger(n)&&n>=1000&&n<=120000?n:10000}
export function loadPaymentProviderConfiguration(source:PaymentProviderConfigurationSource={
 providerId:process.env.PAYMENT_PROVIDER_ID,enabled:process.env.PAYMENT_PROVIDER_ENABLED,mode:process.env.PAYMENT_PROVIDER_MODE,
 publicKey:process.env.PAYMENT_PROVIDER_PUBLIC_KEY,secretReference:process.env.PAYMENT_PROVIDER_SECRET_REFERENCE,
 webhookSecretReference:process.env.PAYMENT_PROVIDER_WEBHOOK_SECRET_REFERENCE,timeoutMs:process.env.PAYMENT_PROVIDER_TIMEOUT_MS,
}):PaymentProviderConfiguration|null{
 const id=source.providerId?.trim().toLowerCase()??"";
 if(!id||!PROVIDER_ID_PATTERN.test(id))return null;
 return {id,enabled:bool(source.enabled,false),mode:mode(source.mode),publicKey:source.publicKey?.trim()||null,
  secretReference:source.secretReference?.trim()||null,webhookSecretReference:source.webhookSecretReference?.trim()||null,
  timeoutMs:timeout(source.timeoutMs),capabilities:{}};
}
export function publicPaymentProviderConfiguration(config:PaymentProviderConfiguration){
 return {id:config.id,mode:config.mode,publicKey:config.publicKey};
}
export function assertPrivatePaymentConfiguration(config:PaymentProviderConfiguration){
 for(const value of [config.secretReference,config.webhookSecretReference])
  if(value&&/^NEXT_PUBLIC_/i.test(value))throw new Error("Private payment configuration cannot use a NEXT_PUBLIC_ environment reference.");
}
