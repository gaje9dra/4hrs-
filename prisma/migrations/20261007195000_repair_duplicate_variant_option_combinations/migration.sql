-- Repair duplicate variant option combinations created before option-combination
-- validation was enforced. Keep the oldest variant active and deactivate
-- later duplicates so storefront rendering remains deterministic.
WITH ranked AS (
  SELECT
    pv.id,
    ROW_NUMBER() OVER (
      PARTITION BY pv."productId",
        (
          SELECT ARRAY_AGG(pvov."optionValueId" ORDER BY pvov."optionValueId")
          FROM "ProductVariantOptionValue" pvov
          WHERE pvov."variantId" = pv.id
        )
      ORDER BY pv."createdAt", pv.id
    ) AS rn
  FROM "ProductVariant" pv
  WHERE EXISTS (
    SELECT 1
    FROM "ProductVariantOptionValue" pvov
    WHERE pvov."variantId" = pv.id
  )
)
UPDATE "ProductVariant" pv
SET "status" = 'INACTIVE', "updatedAt" = NOW()
FROM ranked r
WHERE pv.id = r.id
  AND r.rn > 1
  AND pv."status" = 'ACTIVE';
