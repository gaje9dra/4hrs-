-- Deterministically repair active duplicate variant option combinations.
-- Only active variants participate in storefront uniqueness. Keep the oldest
-- active variant for each product + option-value combination and deactivate
-- every later active duplicate.
WITH active_combinations AS (
  SELECT
    pv.id,
    pv."productId",
    pv."createdAt",
    ARRAY_AGG(pvov."optionValueId" ORDER BY pvov."optionValueId") AS option_combination
  FROM "ProductVariant" pv
  JOIN "ProductVariantOptionValue" pvov
    ON pvov."variantId" = pv.id
  WHERE pv."status" = 'ACTIVE'
  GROUP BY pv.id, pv."productId", pv."createdAt"
),
duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "productId", option_combination
      ORDER BY "createdAt", id
    ) AS rn
  FROM active_combinations
)
UPDATE "ProductVariant" pv
SET
  "status" = 'INACTIVE',
  "updatedAt" = NOW()
FROM duplicates d
WHERE pv.id = d.id
  AND d.rn > 1
  AND pv."status" = 'ACTIVE';

-- Also prevent the application from silently treating two active variants
-- with no option values as distinct combinations.
WITH active_no_option AS (
  SELECT
    pv.id,
    pv."productId",
    ROW_NUMBER() OVER (
      PARTITION BY pv."productId"
      ORDER BY pv."createdAt", pv.id
    ) AS rn
  FROM "ProductVariant" pv
  WHERE pv."status" = 'ACTIVE'
    AND NOT EXISTS (
      SELECT 1
      FROM "ProductVariantOptionValue" pvov
      WHERE pvov."variantId" = pv.id
    )
)
UPDATE "ProductVariant" pv
SET
  "status" = 'INACTIVE',
  "updatedAt" = NOW()
FROM active_no_option d
WHERE pv.id = d.id
  AND d.rn > 1
  AND pv."status" = 'ACTIVE';
