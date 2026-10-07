import { requireAdmin } from "@/lib/admin/authorization";
import { adminCatalogErrorResponse, adminJson, assertAdminSameOrigin, isValidAdminId } from "@/lib/admin/http";
import { addCatalogMedia } from "@/lib/admin/catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  try {
    const context = await requireAdmin(request, "catalog.media.manage");
    assertAdminSameOrigin(request);

    const form = await request.formData();
    const productId = form.get("productId");
    const file = form.get("file");
    const altText = form.get("altText");
    const isPrimary = form.get("isPrimary") === "true";
    const sortOrderRaw = form.get("sortOrder");

    if (typeof productId !== "string" || !isValidAdminId(productId)) {
      return adminJson({ error: { code: "INVALID_REQUEST", message: "Product ID is invalid." } }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return adminJson({ error: { code: "INVALID_REQUEST", message: "Choose an image file to upload." } }, { status: 400 });
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return adminJson({ error: { code: "INVALID_REQUEST", message: "Only JPEG, PNG, WebP, and GIF images are supported." } }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
      return adminJson({ error: { code: "INVALID_REQUEST", message: "Image must be between 1 byte and 4 MB." } }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const dataUrl = "data:" + file.type + ";base64," + bytes.toString("base64");
    const storageReference = "inline-db:" + crypto.randomUUID();

    const media = await addCatalogMedia(context, {
      productId,
      variantId: null,
      url: dataUrl,
      storageReference,
      mediaType: "IMAGE",
      altText: typeof altText === "string" && altText.trim() ? altText.trim() : null,
      isPrimary,
      sortOrder: typeof sortOrderRaw === "string" && /^\\d+$/.test(sortOrderRaw) ? Number(sortOrderRaw) : 0,
    });

    return adminJson({ media }, { status: 201 });
  } catch (error) {
    return adminCatalogErrorResponse(error);
  }
}
