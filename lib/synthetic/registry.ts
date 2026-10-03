import { db } from "@/lib/db/client";
import type { WorkflowDefinition, StepResult } from "./model";

const ok = (diagnostic: Record<string, unknown> = {}): StepResult => ({ status: "HEALTHY", diagnostic });
const blocked = (code: "UNSUPPORTED_SYNTHETIC_CAPABILITY"|"SAFETY_GUARD_BLOCK"|"CONFIGURATION_FAILURE", diagnostic: Record<string, unknown>): StepResult => ({ status: "BLOCKED", failureCode: code, diagnostic });

async function probe(ctx: Parameters<WorkflowDefinition["steps"][number]["execute"]>[0], path: string, marker?: string): Promise<StepResult> {
  if (!ctx.baseUrl) return blocked("CONFIGURATION_FAILURE", { reason: "No synthetic base URL configured." });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ctx.timeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(new URL(path, ctx.baseUrl), { method: "GET", cache: "no-store", redirect: "manual", signal: controller.signal, headers: { "x-synthetic-monitor": "4hrs-plus" } });
    const body = await response.text();
    const durationMs = Math.round(performance.now() - started);
    if (response.status < 200 || response.status >= 400) return { status: "FAILING", failureCode: path.includes("search") ? "SEARCH_FAILURE" : "STOREFRONT_UNAVAILABLE", diagnostic: { status: response.status, durationMs } };
    if (marker && !body.includes(marker)) return { status: "DEGRADED", failureCode: "CATALOG_UNAVAILABLE", diagnostic: { status: response.status, durationMs, markerMissing: marker } };
    return ok({ status: response.status, durationMs });
  } catch (error) {
    return { status: "FAILING", failureCode: error instanceof DOMException && error.name === "AbortError" ? "TIMEOUT" : "STOREFRONT_UNAVAILABLE", diagnostic: { durationMs: Math.round(performance.now() - started) } };
  } finally { clearTimeout(timer); }
}

async function activeProductSlug(): Promise<string | null> {
  const row = await db.product.findFirst({ where: { status: "ACTIVE", variants: { some: { status: "ACTIVE" } } }, select: { slug: true }, orderBy: { updatedAt: "desc" } });
  return row?.slug ?? null;
}

async function activeCategorySlug_DISABLED(): Promise<string | null> {
  const row = await db.category.findFirst({ where: { status: "ACTIVE" }, select: { slug: true }, orderBy: { updatedAt: "desc" } });
  return row?.slug ?? null;
}

const publicWorkflow = (input: Omit<WorkflowDefinition,"steps"> & { steps: WorkflowDefinition["steps"] }): WorkflowDefinition => input;

export const WORKFLOWS: WorkflowDefinition[] = [
  publicWorkflow({id:"STOREFRONT_AVAILABILITY",name:"Storefront availability",domains:["STOREfront"],entryPoint:"GET /",prerequisites:[],expectedOutcome:"Storefront responds successfully.",criticalInvariants:["HTTP success","no server error"],dependencies:["Next.js"],syntheticEligible:true,productionSafe:true,failureSeverity:"P0",timeoutMs:5000,retryPolicy:"READ_ONLY",owner:"storefront",escalationTarget:"reliability",steps:[{key:"homepage",name:"Probe homepage",productionSafe:true,execute:ctx=>probe(ctx,"/")}]}),
  publicWorkflow({id:"HOMEPAGE_RENDERING",name:"Homepage rendering",domains:["STOREfront"],entryPoint:"GET /",prerequisites:["Storefront availability"],expectedOutcome:"Homepage renders.",criticalInvariants:["HTTP success"],dependencies:["Next.js","database"],syntheticEligible:true,productionSafe:true,failureSeverity:"P0",timeoutMs:5000,retryPolicy:"READ_ONLY",owner:"storefront",escalationTarget:"reliability",steps:[{key:"render",name:"Render homepage",productionSafe:true,execute:ctx=>probe(ctx,"/")}]}),
  publicWorkflow({id:"CATEGORY_DISCOVERY",name:"Category discovery",domains:["CATALOG"],entryPoint:"GET /categories",prerequisites:["Catalog"],expectedOutcome:"Categories route responds.",criticalInvariants:["HTTP success"],dependencies:["catalog"],syntheticEligible:true,productionSafe:true,failureSeverity:"P1",timeoutMs:5000,retryPolicy:"READ_ONLY",owner:"catalog",escalationTarget:"catalog-operations",steps:[{key:"categories",name:"Probe categories",productionSafe:true,execute:ctx=>probe(ctx,"/categories")}]}),
  publicWorkflow({id:"SEARCH_DISCOVERY",name:"Search/discovery",domains:["SEARCH","CATALOG"],entryPoint:"GET /search?q=shirt",prerequisites:["Storefront"],expectedOutcome:"Search route responds.",criticalInvariants:["HTTP success"],dependencies:["search"],syntheticEligible:true,productionSafe:true,failureSeverity:"P1",timeoutMs:5000,retryPolicy:"READ_ONLY",owner:"discovery",escalationTarget:"reliability",steps:[{key:"search",name:"Probe search",dependency:"search",productionSafe:true,execute:ctx=>probe(ctx,"/search?q=shirt")}]}),
  publicWorkflow({id:"PRODUCT_DETAIL",name:"Product detail",domains:["CATALOG"],entryPoint:"GET /product/:slug",prerequisites:["Published product"],expectedOutcome:"An active product page responds.",criticalInvariants:["Active product exists","HTTP success"],dependencies:["catalog"],syntheticEligible:true,productionSafe:true,failureSeverity:"P1",timeoutMs:5000,retryPolicy:"READ_ONLY",owner:"catalog",escalationTarget:"catalog-operations",steps:[{key:"product",name:"Probe active product",dependency:"catalog",productionSafe:true,execute:async ctx=>{const slug=await activeProductSlug();if(!slug)return {status:"UNAVAILABLE",failureCode:"CATALOG_UNAVAILABLE",diagnostic:{reason:"No active product fixture exists."}};return probe(ctx,"/product/"+encodeURIComponent(slug));}}]}) ,
  publicWorkflow({id:"VARIANT_AVAILABILITY",name:"Product variant availability",domains:["CATALOG","INVENTORY"],entryPoint:"catalog fixture",prerequisites:["Active product"],expectedOutcome:"An active product has an active variant.",criticalInvariants:["Active variant exists"],dependencies:["database"],syntheticEligible:true,productionSafe:true,failureSeverity:"P1",timeoutMs:3000,retryPolicy:"READ_ONLY",owner:"catalog",escalationTarget:"catalog-operations",steps:[{key:"variant",name:"Check active variant fixture",dependency:"database",productionSafe:true,execute:async()=>{const row=await db.productVariant.findFirst({where:{status:"ACTIVE",product:{status:"ACTIVE"}},select:{id:true,sku:true}});return row?ok({variantId:row.id,sku:row.sku}):{status:"UNAVAILABLE",failureCode:"CATALOG_UNAVAILABLE",diagnostic:{reason:"No active variant fixture exists."}};}}]}),
  publicWorkflow({id:"PRICING_VISIBILITY",name:"Pricing visibility",domains:["CATALOG"],entryPoint:"product catalog",prerequisites:["Active product"],expectedOutcome:"Published product has a non-negative price.",criticalInvariants:["Price exists"],dependencies:["database"],syntheticEligible:true,productionSafe:true,failureSeverity:"P1",timeoutMs:3000,retryPolicy:"READ_ONLY",owner:"catalog",escalationTarget:"catalog-operations",steps:[{key:"price",name:"Check catalog pricing",dependency:"database",productionSafe:true,execute:async()=>{const row=await db.product.findFirst({where:{status:"ACTIVE"},select:{id:true,price:true,currency:true}});return row?ok({productId:row.id,currency:row.currency,pricePresent:true}):{status:"UNAVAILABLE",failureCode:"CATALOG_UNAVAILABLE",diagnostic:{reason:"No active product exists."}};}}]}),
  publicWorkflow({id:"SEO_RENDERING",name:"SEO-critical rendering",domains:["SEO","STOREfront"],entryPoint:"GET /",prerequisites:["Storefront"],expectedOutcome:"Homepage renders metadata-capable HTML.",criticalInvariants:["HTTP success"],dependencies:["Next.js"],syntheticEligible:true,productionSafe:true,failureSeverity:"P1",timeoutMs:5000,retryPolicy:"READ_ONLY",owner:"seo",escalationTarget:"storefront",steps:[{key:"seo",name:"Probe HTML metadata",productionSafe:true,execute:ctx=>probe(ctx,"/","<title")}]}),
  publicWorkflow({id:"CANONICAL_URL",name:"Canonical URL behavior",domains:["SEO"],entryPoint:"GET /",prerequisites:["Storefront"],expectedOutcome:"Homepage contains canonical markup when configured.",criticalInvariants:["No server error"],dependencies:["Next.js"],syntheticEligible:true,productionSafe:true,failureSeverity:"P2",timeoutMs:5000,retryPolicy:"READ_ONLY",owner:"seo",escalationTarget:"storefront",steps:[{key:"canonical",name:"Probe canonical contract",productionSafe:true,execute:ctx=>probe(ctx,"/","canonical")}]}),
  publicWorkflow({id:"BASIC_NAVIGATION",name:"Basic navigation",domains:["STOREfront"],entryPoint:"GET /shop",prerequisites:["Storefront"],expectedOutcome:"Shop route responds.",criticalInvariants:["HTTP success"],dependencies:["Next.js"],syntheticEligible:true,productionSafe:true,failureSeverity:"P2",timeoutMs:5000,retryPolicy:"READ_ONLY",owner:"storefront",escalationTarget:"storefront",steps:[{key:"shop",name:"Probe shop route",productionSafe:true,execute:ctx=>probe(ctx,"/shop")}]}) ,
];

const BLOCKED = [
  ["CART_LIFECYCLE","Cart","Production mutation requires an isolated synthetic customer/cart fixture."],
  ["CUSTOMER_AUTHENTICATION","Customer","Production authentication requires a dedicated synthetic credential contract."],
  ["CUSTOMER_ACCOUNT_LIFECYCLE","Customer","Production account mutation requires a dedicated synthetic identity contract."],
  ["CHECKOUT_INITIALIZATION","Checkout","Checkout mutation is blocked without a safe synthetic cart fixture."],
  ["CHECKOUT_VALIDATION","Checkout","Checkout mutation is blocked without a safe synthetic cart fixture."],
  ["PAYMENT_INITIATION","Payment","Real payment mutation is never allowed; boundary-only validation is used."],
  ["PAYMENT_SUCCESS_HANDLING","Payment","Production payment success requires an approved zero-value/sandbox contract."],
  ["PAYMENT_FAILURE_HANDLING","Payment","Production payment failure injection is not permitted."],
  ["ORDER_CREATION","Order","Production order mutation is blocked unless a dedicated safe test path exists."],
  ["ORDER_IDEMPOTENCY","Order","Production order mutation is blocked unless a dedicated safe test path exists."],
  ["FULFILLMENT_HANDOFF","Fulfillment","Production provider mutation is blocked unless a safe provider test account exists."],
  ["PROVIDER_MAPPING_RESOLUTION","Fulfillment","Provider mutation is not required for read-only mapping validation."],
  ["QIKINK_ADAPTER_BOUNDARY","Providers","Qikink remains server-side; live provider order creation is blocked."],
  ["SHIPMENT_LIFECYCLE","Shipping","No safe production shipment mutation contract exists."],
  ["TRACKING_VISIBILITY","Shipping","Live provider tracking cannot be fabricated."],
  ["CANCELLATION","Cancellations","Production cancellation mutation is not permitted for synthetic monitoring."],
  ["RETURN_LIFECYCLE","Returns","Production return/refund mutation is not permitted for synthetic monitoring."],
  ["CUSTOMER_COMMUNICATION","Notifications","Synthetic recipients require a controlled sink/suppression contract."],
  ["COMMUNICATION_PREFERENCE","Notifications","Customer preference mutation requires a dedicated synthetic account."],
  ["ADMIN_ORDER_OPERATIONS","Admin","Admin mutation requires a dedicated least-privilege synthetic operator."],
  ["ADMIN_FULFILLMENT_OPERATIONS","Admin","Admin provider mutation remains blocked."],
  ["ADMIN_SHIPPING_OPERATIONS","Admin","Admin shipping mutation remains blocked."],
  ["ADMIN_CUSTOMER_OPERATIONS","Admin","Admin customer mutation requires dedicated synthetic operator."],
  ["ADMIN_RECONCILIATION","Reconciliation","Read-only admin visibility can be validated; mutation is excluded."],
  ["GOVERNANCE_AUDIT","Governance","Certification evidence is recorded by the synthetic layer; control mutation is blocked."],
  ["FEATURE_FLAG_CONTROLLED","Feature Flags","Evaluation is safe; production flag mutation is blocked."],
  ["ANALYTICS_EMISSION","Analytics","Synthetic events require explicit exclusion configuration."],
  ["SEARCH_INDEX_CONSISTENCY","Search","Monitoring reports discrepancies; it never silently repairs indexes."],
  ["CONTENT_PUBLISHING","Content","Production content mutation requires a dedicated fixture."],
  ["CUSTOMER_DATA_CONTROLS","Privacy","Customer data controls require a dedicated synthetic account."],
];

export const BLOCKED_WORKFLOW_DEFINITIONS: WorkflowDefinition[] = BLOCKED.map(([id,domain,blockedReason])=>({
  id, name:id.replaceAll("_"," "), domains:[domain], entryPoint:"existing application contract", prerequisites:[], expectedOutcome:"Capability is validated safely or explicitly blocked.", criticalInvariants:["No unsafe mutation"], dependencies:[domain], syntheticEligible:true, productionSafe:false, failureSeverity:(id.includes("PAYMENT")||id.includes("ORDER")||id.includes("FULFILLMENT")?"P0":"P1") as "P0"|"P1", timeoutMs:5000, retryPolicy:"NONE", owner:domain.toLowerCase(), escalationTarget:"reliability", blockedReason, steps:[{key:"safety-gate",name:"Evaluate safety gate",productionSafe:false,execute:async()=>blocked("UNSUPPORTED_SYNTHETIC_CAPABILITY",{reason:blockedReason})}],
}));

export const WORKFLOW_REGISTRY = [...WORKFLOWS,...BLOCKED_WORKFLOW_DEFINITIONS];

export function getWorkflow(id:string): WorkflowDefinition | undefined { return WORKFLOW_REGISTRY.find(w=>w.id===id); }
export function validateWorkflowRegistry(): string[] {
  const errors:string[]=[]; const seen=new Set<string>();
  for(const w of WORKFLOW_REGISTRY){
    if(seen.has(w.id)) errors.push(`duplicate workflow id: ${w.id}`); seen.add(w.id);
    if(!w.steps.length) errors.push(`workflow has no steps: ${w.id}`);
    if(w.timeoutMs<1000||w.timeoutMs>120000) errors.push(`invalid timeout: ${w.id}`);
    if(w.productionSafe && w.steps.some(s=>!s.productionSafe)) errors.push(`production-safe workflow contains unsafe step: ${w.id}`);
  }
  return errors;
}
