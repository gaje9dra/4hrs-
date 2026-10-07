import { Prisma, type FeatureFlagEnvironment, type MerchandisingRuleAction, type MerchandisingRuleScope } from "@prisma/client";
import { db } from "@/lib/db/client";

const KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{0,99}$/;
const MAX_PRIORITY = 1000;

export class MerchandisingError extends Error {
  constructor(public readonly code: "INVALID_CONFIGURATION" | "NOT_FOUND" | "CONFLICT" | "DATABASE_ERROR", message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "MerchandisingError";
  }
}

export type MerchandisingRuleInput = {
  name: unknown;
  description?: unknown;
  environment: unknown;
  action: unknown;
  scope: unknown;
  scopeValue?: unknown;
  productId?: unknown;
  locale?: unknown;
  priority?: unknown;
  active?: unknown;
  startAt?: unknown;
  endAt?: unknown;
};

const ACTIONS = new Set<MerchandisingRuleAction>(["PIN","BOOST","PROMOTE","DEMOTE","BURY"]);
const SCOPES = new Set<MerchandisingRuleScope>(["GLOBAL","CATEGORY","COLLECTION","QUERY","PRODUCT","LOCALE"]);
const ENVIRONMENTS = new Set<FeatureFlagEnvironment>(["DEVELOPMENT","TEST","STAGING","PRODUCTION"]);

function parseDate(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new MerchandisingError("INVALID_CONFIGURATION", field + " must be an ISO timestamp.");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new MerchandisingError("INVALID_CONFIGURATION", field + " is invalid.");
  return date;
}

export function validateMerchandisingRuleInput(input: MerchandisingRuleInput) {
  if (typeof input.name !== "string" || input.name.trim().length < 2 || input.name.trim().length > 160) {
    throw new MerchandisingError("INVALID_CONFIGURATION", "Merchandising rule name is invalid.");
  }
  if (!ENVIRONMENTS.has(input.environment as FeatureFlagEnvironment)) throw new MerchandisingError("INVALID_CONFIGURATION", "Merchandising environment is invalid.");
  if (!ACTIONS.has(input.action as MerchandisingRuleAction)) throw new MerchandisingError("INVALID_CONFIGURATION", "Merchandising action is invalid.");
  if (!SCOPES.has(input.scope as MerchandisingRuleScope)) throw new MerchandisingError("INVALID_CONFIGURATION", "Merchandising scope is invalid.");

  const scope = input.scope as MerchandisingRuleScope;
  const scopeValue = typeof input.scopeValue === "string" ? input.scopeValue.trim() : null;
  const productId = typeof input.productId === "string" ? input.productId.trim() : null;
  const locale = typeof input.locale === "string" ? input.locale.trim().slice(0, 16) : null;

  if (scope === "GLOBAL" && (scopeValue || productId || locale)) throw new MerchandisingError("INVALID_CONFIGURATION", "Global rules cannot carry a scope value, product, or locale.");
  if (scope === "PRODUCT" && !productId) throw new MerchandisingError("INVALID_CONFIGURATION", "Product scope requires productId.");
  if (scope !== "PRODUCT" && productId) throw new MerchandisingError("INVALID_CONFIGURATION", "productId is only valid for PRODUCT scope.");
  if (scope === "QUERY" && (!scopeValue || !KEY_PATTERN.test(scopeValue.toLowerCase()))) throw new MerchandisingError("INVALID_CONFIGURATION", "Query scope requires a normalized query key.");
  if ((scope === "CATEGORY" || scope === "COLLECTION") && (!scopeValue || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(scopeValue))) {
    throw new MerchandisingError("INVALID_CONFIGURATION", "Category and collection scopes require canonical slugs.");
  }
  if (scope === "LOCALE" && !locale) throw new MerchandisingError("INVALID_CONFIGURATION", "Locale scope requires locale.");
  if (scope !== "LOCALE" && locale) throw new MerchandisingError("INVALID_CONFIGURATION", "locale is only valid for LOCALE scope.");

  const priority = input.priority === undefined ? 0 : input.priority;
  if (typeof priority !== "number" || !Number.isInteger(priority) || priority < -MAX_PRIORITY || priority > MAX_PRIORITY) {
    throw new MerchandisingError("INVALID_CONFIGURATION", "Priority must be an integer from -1000 to 1000.");
  }
  const active = input.active === undefined ? false : input.active;
  if (typeof active !== "boolean") throw new MerchandisingError("INVALID_CONFIGURATION", "Active must be boolean.");

  const startAt = parseDate(input.startAt, "startAt");
  const endAt = parseDate(input.endAt, "endAt");
  if (startAt && endAt && endAt <= startAt) throw new MerchandisingError("INVALID_CONFIGURATION", "endAt must be after startAt.");

  return {
    name: input.name.trim(),
    description: typeof input.description === "string" ? input.description.trim().slice(0, 1000) : null,
    environment: input.environment as FeatureFlagEnvironment,
    action: input.action as MerchandisingRuleAction,
    scope,
    scopeValue,
    productId,
    locale,
    priority,
    active,
    startAt,
    endAt,
  };
}

export async function listMerchandisingRules(environment?: FeatureFlagEnvironment) {
  return db.merchandisingRule.findMany({
    where: environment ? { environment } : undefined,
    orderBy: [{ active: "desc" }, { priority: "desc" }, { createdAt: "desc" }, { id: "asc" }],
  });
}

export async function getMerchandisingRule(id: string) {
  return db.merchandisingRule.findUnique({ where: { id } });
}

export async function createMerchandisingRule(input: MerchandisingRuleInput) {
  const value = validateMerchandisingRuleInput(input);
  try {
    return await db.merchandisingRule.create({ data: value });
  } catch (error) {
    throw new MerchandisingError("DATABASE_ERROR", "Merchandising rule could not be created.", { cause: error });
  }
}

export async function updateMerchandisingRule(id: string, expectedVersion: number, input: MerchandisingRuleInput) {
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw new MerchandisingError("CONFLICT", "A valid expectedVersion is required.");
  const value = validateMerchandisingRuleInput(input);
  try {
    const result = await db.merchandisingRule.updateMany({
      where: { id, version: expectedVersion },
      data: { ...value, version: { increment: 1 } },
    });
    if (result.count !== 1) {
      const current = await db.merchandisingRule.findUnique({ where: { id }, select: { id: true } });
      throw new MerchandisingError(current ? "CONFLICT" : "NOT_FOUND", current ? "Merchandising rule version is stale." : "Merchandising rule was not found.");
    }
    return db.merchandisingRule.findUniqueOrThrow({ where: { id } });
  } catch (error) {
    if (error instanceof MerchandisingError) throw error;
    throw new MerchandisingError("DATABASE_ERROR", "Merchandising rule could not be updated.", { cause: error });
  }
}

export async function deactivateMerchandisingRule(id: string, expectedVersion: number) {
  return updateMerchandisingRule(id, expectedVersion, {
    name: (await getMerchandisingRule(id))?.name ?? "rule",
    environment: (await getMerchandisingRule(id))?.environment ?? "PRODUCTION",
    action: (await getMerchandisingRule(id))?.action ?? "BOOST",
    scope: (await getMerchandisingRule(id))?.scope ?? "GLOBAL",
    scopeValue: (await getMerchandisingRule(id))?.scopeValue,
    productId: (await getMerchandisingRule(id))?.productId,
    locale: (await getMerchandisingRule(id))?.locale,
    priority: (await getMerchandisingRule(id))?.priority ?? 0,
    active: false,
    startAt: (await getMerchandisingRule(id))?.startAt?.toISOString(),
    endAt: (await getMerchandisingRule(id))?.endAt?.toISOString(),
  });
}

export function merchandisingPrecedence(action: MerchandisingRuleAction): number {
  if (action === "PIN") return 0;
  if (action === "BOOST" || action === "PROMOTE") return 1;
  if (action === "DEMOTE") return 2;
  if (action === "BURY") return 3;
  return 4;
}

export type MerchandisingSqlContext = {
  environment: FeatureFlagEnvironment;
  query?: string;
  categorySlug?: string;
  collectionSlug?: string;
  locale?: string;
};

export function merchandisingOrderSql(context: MerchandisingSqlContext): Prisma.Sql {
  const activeWindow = Prisma.sql`r."active" = true
    AND r."environment" = CAST(${context.environment} AS "FeatureFlagEnvironment")
    AND (r."startAt" IS NULL OR r."startAt" <= CURRENT_TIMESTAMP)
    AND (r."endAt" IS NULL OR r."endAt" > CURRENT_TIMESTAMP)`;
  const scopes: Prisma.Sql[] = [
    Prisma.sql`r."scope" = 'GLOBAL'`,
    Prisma.sql`(r."scope" = 'PRODUCT' AND r."productId" = p."id")`,
  ];
  if (context.categorySlug) scopes.push(Prisma.sql`(r."scope" = 'CATEGORY' AND r."scopeValue" = ${context.categorySlug})`);
  if (context.collectionSlug) scopes.push(Prisma.sql`(r."scope" = 'COLLECTION' AND r."scopeValue" = ${context.collectionSlug})`);
  if (context.query) scopes.push(Prisma.sql`(r."scope" = 'QUERY' AND r."scopeValue" = ${context.query})`);
  if (context.locale) scopes.push(Prisma.sql`(r."scope" = 'LOCALE' AND r."locale" = ${context.locale})`);

  const scopeMatch = Prisma.sql`(${Prisma.join(scopes, " OR ")})`;
  return Prisma.sql`
    CASE
      WHEN EXISTS (SELECT 1 FROM "MerchandisingRule" r WHERE ${activeWindow} AND r."action" = 'PIN' AND ${scopeMatch}) THEN 0
      WHEN EXISTS (SELECT 1 FROM "MerchandisingRule" r WHERE ${activeWindow} AND r."action" IN ('BOOST','PROMOTE') AND ${scopeMatch}) THEN 1
      WHEN EXISTS (SELECT 1 FROM "MerchandisingRule" r WHERE ${activeWindow} AND r."action" = 'DEMOTE' AND ${scopeMatch}) THEN 2
      WHEN EXISTS (SELECT 1 FROM "MerchandisingRule" r WHERE ${activeWindow} AND r."action" = 'BURY' AND ${scopeMatch}) THEN 3
      ELSE 4
    END
  `;
}
