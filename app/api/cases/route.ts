import { assertSameOrigin } from "@/lib/auth/http";
import {createCaseApplication,parseCaseCategory} from "@/lib/cases/application";import {casesError,casesJson,readCasesJson} from "@/lib/cases/http";
export const dynamic="force-dynamic";export const revalidate=0;
export async function GET(request:Request){try{return casesJson({cases:await createCaseApplication().getCustomerCases(request)});}catch(e){return casesError(e);}}
export async function POST(request:Request){try{assertSameOrigin(request);const b=await readCasesJson(request);const parsedCategory=parseCaseCategory(b.category);return casesJson({case:await createCaseApplication().createCustomerCase({category:parsedCategory,title:b.title as string,description:typeof b.description==="string"?b.description:undefined,orderNumber:typeof b.orderNumber==="string"?b.orderNumber:undefined,idempotencyKey:request.headers.get("idempotency-key")??undefined,request})},{status:201});}catch(e){return casesError(e);}}
