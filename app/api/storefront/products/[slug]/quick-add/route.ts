import { NextResponse } from "next/server";
import { getStorefrontProduct } from "@/lib/storefront/catalog";
import { CatalogServiceError } from "@/lib/catalog/errors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const product = await getStorefrontProduct(slug);
    return NextResponse.json({
      id: product.id,
      title: product.title,
      options: product.options.map((option) => ({
        id: option.id,
        name: option.name,
        values: option.values.map((value) => ({ id: value.id, displayName: value.displayName })),
      })),
      variants: product.variants.map((variant) => ({
        id: variant.id,
        displayName: variant.displayName,
        size: variant.size,
        color: variant.color,
        availability: variant.availability,
        optionValues: variant.optionValues.map((value) => ({
          id: value.id,
          optionType: { id: value.optionType.id },
        })),
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof CatalogServiceError && error.code === "PRODUCT_NOT_FOUND") {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    console.error("[storefront/quick-add] Unable to load product options", error);
    return NextResponse.json({ error: "Product options are temporarily unavailable." }, { status: 500 });
  }
}
