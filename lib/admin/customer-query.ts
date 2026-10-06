import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { AdminError } from "@/lib/admin/errors";
import { parseCustomerSort, parseSortDirection, parseCustomerStatus, type CustomerSort, type CustomerStatus } from "@/lib/customer/domain";

const MAX_PAGE_SIZE=50, MAX_PAGE=200;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AdminCustomerQuery={search:string;status?:CustomerStatus;verified?:"verified"|"unverified";createdFrom?:string;createdTo?:string;lastActivityFrom?:string;lastActivityTo?:string;orderCountMin?:number;orderCountMax?:number;valueMin?:string;valueMax?:string;page:number;pageSize:number;sort:CustomerSort;direction:"asc"|"desc"};

function int(v:string|null,f:number,m:number){if(!v)return f;if(!/^\d+$/.test(v))throw new AdminError("INVALID_REQUEST","Customer pagination/filter is invalid.");const n=Number(v);if(!Number.isSafeInteger(n)||n<1||n>m)throw new AdminError("INVALID_REQUEST","Customer pagination/filter is invalid.");return n;}
function date(v:string|null,n:string){if(!v)return undefined;if(!/^\d{4}-\d{2}-\d{2}$/.test(v))throw new AdminError("INVALID_REQUEST",n+" is invalid.");const d=new Date(v+"T00:00:00.000Z");if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==v)throw new AdminError("INVALID_REQUEST",n+" is invalid.");return v;}
function money(v:string|null,n:string){if(!v)return undefined;if(!/^\d{1,10}(?:\.\d{1,2})?$/.test(v))throw new AdminError("INVALID_REQUEST",n+" is invalid.");return v;}
function like(v:string){return v.replaceAll("\\","\\\\").replaceAll("%","\\%").replaceAll("_","\\_");}

export function parseAdminCustomerQuery(url:URL,permissions?:Set<string>):AdminCustomerQuery{
 const search=url.searchParams.get("search")?.trim()??"";
 if(search.length>80)throw new AdminError("INVALID_REQUEST","Customer search is too long.");
 const status=parseCustomerStatus(url.searchParams.get("status"));
 const verified=url.searchParams.get("verified")||undefined;
 if(verified&&verified!=="verified"&&verified!=="unverified")throw new AdminError("INVALID_REQUEST","Verification filter is invalid.");
 const sort=parseCustomerSort(url.searchParams.get("sort"));
 const direction=parseSortDirection(url.searchParams.get("direction"));
 const valueMin=money(url.searchParams.get("valueMin"),"Minimum customer value");
 const valueMax=money(url.searchParams.get("valueMax"),"Maximum customer value");
 if((valueMin||valueMax||sort==="grossPurchaseValue")&&permissions&&!permissions.has("customers.financial.read"))throw new AdminError("FORBIDDEN","Financial customer information requires the customers.financial.read permission.");
 if(valueMin&&valueMax&&Number(valueMin)>Number(valueMax))throw new AdminError("INVALID_REQUEST","Customer value range is invalid.");
 return {search,status,verified:verified as AdminCustomerQuery["verified"],createdFrom:date(url.searchParams.get("createdFrom"),"Created-from date"),createdTo:date(url.searchParams.get("createdTo"),"Created-to date"),lastActivityFrom:date(url.searchParams.get("lastActivityFrom"),"Activity-from date"),lastActivityTo:date(url.searchParams.get("lastActivityTo"),"Activity-to date"),orderCountMin:url.searchParams.get("orderCountMin")?int(url.searchParams.get("orderCountMin"),0,1000000):undefined,orderCountMax:url.searchParams.get("orderCountMax")?int(url.searchParams.get("orderCountMax"),0,1000000):undefined,valueMin,valueMax,page:int(url.searchParams.get("page"),1,MAX_PAGE),pageSize:int(url.searchParams.get("pageSize"),25,MAX_PAGE_SIZE),sort,direction};
}

function orderBy(sort:CustomerSort,d:"asc"|"desc"){const dir=d.toUpperCase();if(sort==="updatedAt")return '"updatedAt" '+dir+', "id" ASC';if(sort==="displayName")return '"displayName" '+dir+' NULLS LAST, "id" ASC';if(sort==="email")return '"email" '+dir+', "id" ASC';if(sort==="orderCount")return '"orderCount" '+dir+', "id" ASC';if(sort==="grossPurchaseValue")return '"grossPurchaseValue" '+dir+' NULLS LAST, "id" ASC';return '"createdAt" '+dir+', "id" ASC';}

export async function listAdminCustomers(q:AdminCustomerQuery){
 const where:Prisma.Sql[]=[];
 const add=(fragment:Prisma.Sql)=>where.push(fragment);
 if(q.search){
   if(UUID.test(q.search)) add(Prisma.sql`c."id" = ${q.search}::uuid`);
   else { const p=like(q.search); add(Prisma.sql`(c."email" ILIKE ${p+"%"} ESCAPE '\\\\' OR c."displayName" ILIKE ${p+"%"} ESCAPE '\\\\')`); }
 }
 if(q.status) add(Prisma.sql`c."status" = ${q.status}::"CustomerAccountStatus"`);
 if(q.verified==="verified") add(Prisma.sql`c."emailVerifiedAt" IS NOT NULL`);
 if(q.verified==="unverified") add(Prisma.sql`c."emailVerifiedAt" IS NULL`);
 if(q.createdFrom) add(Prisma.sql`c."createdAt" >= ${q.createdFrom}::date`);
 if(q.createdTo) add(Prisma.sql`c."createdAt" < (${q.createdTo}::date + INTERVAL '1 day')`);
 const activity=Prisma.sql`GREATEST(c."updatedAt",COALESCE(os."lastOrderActivity",c."updatedAt"),COALESCE(cs."lastCaseActivity",c."updatedAt"))`;
 if(q.lastActivityFrom) add(Prisma.sql`${activity} >= ${q.lastActivityFrom}::date`);
 if(q.lastActivityTo) add(Prisma.sql`${activity} < (${q.lastActivityTo}::date + INTERVAL '1 day')`);
 if(q.orderCountMin) add(Prisma.sql`COALESCE(os."orderCount",0) >= ${q.orderCountMin}`);
 if(q.orderCountMax) add(Prisma.sql`COALESCE(os."orderCount",0) <= ${q.orderCountMax}`);
 if(q.valueMin) add(Prisma.sql`COALESCE(os."grossPurchaseValue",0) >= ${q.valueMin}::numeric`);
 if(q.valueMax) add(Prisma.sql`COALESCE(os."grossPurchaseValue",0) <= ${q.valueMax}::numeric`);
 const whereSql=where.length===0?Prisma.empty:where.slice(1).reduce<Prisma.Sql>((sql,fragment)=>Prisma.sql`${sql} AND ${fragment}`,Prisma.sql` WHERE ${where[0]}`);
 const offset=(q.page-1)*q.pageSize;
 const orderSql=Prisma.raw(orderBy(q.sort,q.direction));
 const sql=Prisma.sql`WITH os AS (
   SELECT o."customerId",COUNT(*)::bigint AS "orderCount",
   COUNT(*) FILTER (WHERE p."status" IN ('SUCCEEDED','REFUNDED','PARTIALLY_REFUNDED'))::bigint AS "paidOrderCount",
   CASE WHEN COUNT(DISTINCT o."currency") FILTER (WHERE p."status" IN ('SUCCEEDED','REFUNDED','PARTIALLY_REFUNDED'))<=1
     AND COALESCE(MAX(o."currency") FILTER (WHERE p."status" IN ('SUCCEEDED','REFUNDED','PARTIALLY_REFUNDED')),'INR')='INR'
     THEN SUM(o."total") FILTER (WHERE p."status" IN ('SUCCEEDED','REFUNDED','PARTIALLY_REFUNDED')) ELSE NULL END AS "grossPurchaseValue",
   MAX(o."updatedAt") AS "lastOrderActivity"
   FROM "Order" o JOIN "Payment" p ON p."id"=o."paymentId" GROUP BY o."customerId"
 ),cs AS (
   SELECT "customerId",MAX("updatedAt") AS "lastCaseActivity" FROM "Case" GROUP BY "customerId"
 ),base AS (
   SELECT c."id",c."email",c."displayName",c."status",c."emailVerifiedAt",c."createdAt",c."updatedAt",
   COALESCE(os."orderCount",0)::bigint AS "orderCount",COALESCE(os."paidOrderCount",0)::bigint AS "paidOrderCount",
   os."grossPurchaseValue",${activity} AS "lastActivity"
   FROM "Customer" c LEFT JOIN os ON os."customerId"=c."id" LEFT JOIN cs ON cs."customerId"=c."id"${whereSql}
 ) SELECT base.*,COUNT(*) OVER()::bigint AS "totalCount" FROM base ORDER BY ${orderSql} LIMIT ${q.pageSize} OFFSET ${offset}`;
 const rows=await db.$queryRaw<Array<{id:string;email:string;displayName:string|null;status:CustomerStatus;emailVerifiedAt:Date|null;createdAt:Date;updatedAt:Date;orderCount:bigint;paidOrderCount:bigint;grossPurchaseValue:{toFixed:(n:number)=>string}|null;lastActivity:Date;totalCount:bigint}>>(sql);
 const total=Number(rows[0]?.totalCount??BigInt(0));
 return {customers:rows.map(r=>({id:r.id,email:r.email,displayName:r.displayName,status:r.status,emailVerifiedAt:r.emailVerifiedAt?.toISOString()??null,createdAt:r.createdAt.toISOString(),updatedAt:r.updatedAt.toISOString(),lastActivity:r.lastActivity.toISOString(),orderCount:Number(r.orderCount),paidOrderCount:Number(r.paidOrderCount),grossPurchaseValue:(q.valueMin||q.valueMax||q.sort==="grossPurchaseValue")?(r.grossPurchaseValue?.toFixed(2)??null):null})),pagination:{page:q.page,pageSize:q.pageSize,total,totalPages:Math.ceil(total/q.pageSize),hasNextPage:q.page*q.pageSize<total}};
}
