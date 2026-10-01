import type {PaymentProviderClientAction} from "@/lib/payments/provider";
export function normalizeClientAction(action:PaymentProviderClientAction|undefined):PaymentProviderClientAction{
 if(!action)return {type:"NONE"};
 if(action.type==="REDIRECT"){try{const u=new URL(action.redirectUrl);if(u.protocol!=="https:")return {type:"NONE"};return {type:"REDIRECT",redirectUrl:u.toString(),...(action.publicReference?{publicReference:action.publicReference}:{})}}catch{return {type:"NONE"}}}
 if(action.type==="EMBEDDED"||action.type==="SDK_ACTION"){
  if(!action.publicToken||action.publicToken.length>2048)return {type:"NONE"};
  return {type:action.type,publicToken:action.publicToken,...(action.publicReference?{publicReference:action.publicReference}:{})};
 }
 return {type:"NONE"};
}
