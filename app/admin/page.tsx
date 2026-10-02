"use client";

import { useEffect, useState, type FormEvent } from "react";

type Variant = {
  id: string;
  sku: string;
  displayName: string | null;
  size: string | null;
  color: string | null;
  status: string;
  price: string | number | null;
  compareAtPrice: string | number | null;
};

type Product = {
  id: string;
  title: string;
  slug: string;
  status: string;
  price: string | number;
  compareAtPrice: string | number | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  variants?: Variant[];
};

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message ?? body.error ?? "Request failed.");
  return body;
}

export default function AdminCatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<"DRAFT" | "ACTIVE">("DRAFT");
  const [message, setMessage] = useState("");

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [price, setPrice] = useState("");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [sku, setSku] = useState("");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [description, setDescription] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");

  async function loadProducts(selectedStatus = status): Promise<Product[]> {
    const data = await api("/api/admin/catalog?status=" + selectedStatus);
    return data.items ?? [];
  }

  async function refresh(selectedStatus = status) {
    setProducts(await loadProducts(selectedStatus));
  }

  useEffect(() => {
    let cancelled = false;
    void loadProducts()
      .then((items) => { if (!cancelled) setProducts(items); })
      .catch((error) => { if (!cancelled) setMessage(error instanceof Error ? error.message : "Unable to load catalog."); });
    return () => { cancelled = true; };
  }, [status]);

  async function createProduct(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      const created = await api("/api/admin/catalog", {
        method: "POST",
        body: JSON.stringify({
          title,
          slug,
          description: description || null,
          shortDescription: null,
          status: "DRAFT",
          price,
          compareAtPrice: compareAtPrice || null,
          currency: "INR",
          seoTitle: seoTitle || null,
          seoDescription: seoDescription || null,
        }),
      });

      await api("/api/admin/catalog/variants", {
        method: "POST",
        body: JSON.stringify({
          productId: created.product.id,
          sku,
          displayName: [color, size].filter(Boolean).join(" / ") || sku,
          size: size || null,
          color: color || null,
          status: "ACTIVE",
          price: null,
          compareAtPrice: null,
        }),
      });

      setTitle(""); setSlug(""); setPrice(""); setCompareAtPrice(""); setSku("");
      setSize(""); setColor(""); setDescription(""); setSeoTitle(""); setSeoDescription("");
      setMessage("Product and variant created. Add its Qikink mapping before publishing.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create product.");
    }
  }

  async function updateProduct(product: Product, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/admin/catalog", {
        method: "PATCH",
        body: JSON.stringify({
          id: product.id,
          title: String(form.get("title") ?? ""),
          slug: product.slug,
          description: String(form.get("description") ?? "") || null,
          price: String(form.get("price") ?? ""),
          compareAtPrice: String(form.get("compareAtPrice") ?? "") || null,
          currency: "INR",
          seoTitle: String(form.get("seoTitle") ?? "") || null,
          seoDescription: String(form.get("seoDescription") ?? "") || null,
        }),
      });
      setMessage("Product updated.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update product.");
    }
  }

  async function updateVariant(variant: Variant, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/admin/catalog/variants", {
        method: "PATCH",
        body: JSON.stringify({
          id: variant.id,
          sku: String(form.get("sku") ?? ""),
          displayName: String(form.get("displayName") ?? "") || null,
          size: String(form.get("size") ?? "") || null,
          color: String(form.get("color") ?? "") || null,
          status: String(form.get("status") ?? "ACTIVE"),
          price: String(form.get("price") ?? "") || null,
          compareAtPrice: String(form.get("compareAtPrice") ?? "") || null,
        }),
      });
      setMessage("Variant updated.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update variant.");
    }
  }

  async function saveMapping(variantId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/admin/catalog/mappings", {
        method: "POST",
        body: JSON.stringify({
          variantId,
          providerId: "qikink",
          providerSku: String(form.get("providerSku") ?? ""),
          providerVariantReference: String(form.get("providerVariantReference") ?? "") || null,
          active: true,
        }),
      });
      setMessage("Qikink mapping saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save mapping.");
    }
  }

  async function addImage(productId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/admin/catalog/images", {
        method: "POST",
        body: JSON.stringify({
          productId,
          url: String(form.get("url") ?? ""),
          altText: String(form.get("altText") ?? "") || null,
          sortOrder: Number(form.get("sortOrder") ?? 0),
          isPrimary: form.get("isPrimary") === "on",
          mediaType: "IMAGE",
        }),
      });
      event.currentTarget.reset();
      setMessage("Product image added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add image.");
    }
  }

  async function changePublication(productId: string, action: "publish" | "unpublish") {
    try {
      await api("/api/admin/catalog/publish", {
        method: "POST",
        body: JSON.stringify({ productId, action }),
      });
      setMessage(action === "publish" ? "Product published." : "Product unpublished.");
      const nextStatus = action === "publish" ? "ACTIVE" : "DRAFT";
      setStatus(nextStatus);
      await refresh(nextStatus);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to change publication state.");
    }
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 32 }}>
      <h1>4HRS+ Catalog Admin</h1>
      <p>4HRS+ owns the storefront catalog. Qikink is fulfillment only.</p>

      <form onSubmit={createProduct} style={{ display: "grid", gap: 8, maxWidth: 620 }}>
        <h2>Create product</h2>
        <input required placeholder="Product title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input required placeholder="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
        <input required placeholder="Selling price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        <input placeholder="Compare-at price" inputMode="decimal" value={compareAtPrice} onChange={(e) => setCompareAtPrice(e.target.value)} />
        <input required placeholder="4HRS+ Store SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
        <input placeholder="Size" value={size} onChange={(e) => setSize(e.target.value)} />
        <input placeholder="Color" value={color} onChange={(e) => setColor(e.target.value)} />
        <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <input placeholder="SEO title" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
        <textarea placeholder="SEO description" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} />
        <button type="submit">Create product + variant</button>
      </form>

      {message && <p>{message}</p>}

      <div style={{ display: "flex", gap: 8, margin: "24px 0 12px" }}>
        <button type="button" onClick={() => setStatus("DRAFT")}>Draft products</button>
        <button type="button" onClick={() => setStatus("ACTIVE")}>Published products</button>
      </div>

      {products.map((product) => (
        <article key={product.id} style={{ border: "1px solid #ddd", padding: 20, marginTop: 16 }}>
          <form onSubmit={(event) => void updateProduct(product, event)} style={{ display: "grid", gap: 8 }}>
            <strong>{product.title} — {product.status}</strong>
            <input name="title" defaultValue={product.title} aria-label="Product title" />
            <input name="price" defaultValue={String(product.price)} aria-label="Selling price" />
            <input name="compareAtPrice" defaultValue={product.compareAtPrice == null ? "" : String(product.compareAtPrice)} aria-label="Compare-at price" />
            <textarea name="description" defaultValue={product.description ?? ""} aria-label="Description" />
            <input name="seoTitle" defaultValue={product.seoTitle ?? ""} aria-label="SEO title" />
            <textarea name="seoDescription" defaultValue={product.seoDescription ?? ""} aria-label="SEO description" />
            <button type="submit">Save product</button>
          </form>

          <form onSubmit={(event) => void addImage(product.id, event)} style={{ display: "grid", gap: 8, marginTop: 16 }}>
            <strong>Product image</strong>
            <input name="url" required placeholder="https://..." aria-label="Image URL" />
            <input name="altText" placeholder="Alt text" aria-label="Image alt text" />
            <input name="sortOrder" type="number" min="0" defaultValue="0" aria-label="Image order" />
            <label><input name="isPrimary" type="checkbox" /> Primary image</label>
            <button type="submit">Add image</button>
          </form>

          {(product.variants ?? []).map((variant) => (
            <div key={variant.id} style={{ borderTop: "1px solid #eee", marginTop: 16, paddingTop: 16 }}>
              <form onSubmit={(event) => void updateVariant(variant, event)} style={{ display: "grid", gap: 8 }}>
                <strong>Variant — Store SKU: {variant.sku}</strong>
                <input name="sku" defaultValue={variant.sku} aria-label="Store SKU" />
                <input name="displayName" defaultValue={variant.displayName ?? ""} aria-label="Variant display name" />
                <input name="size" defaultValue={variant.size ?? ""} aria-label="Size" />
                <input name="color" defaultValue={variant.color ?? ""} aria-label="Color" />
                <input name="price" defaultValue={variant.price == null ? "" : String(variant.price)} aria-label="Variant price" />
                <input name="compareAtPrice" defaultValue={variant.compareAtPrice == null ? "" : String(variant.compareAtPrice)} aria-label="Variant compare-at price" />
                <select name="status" defaultValue={variant.status} aria-label="Variant status">
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
                <button type="submit">Save variant</button>
              </form>

              <form onSubmit={(event) => void saveMapping(variant.id, event)} style={{ display: "grid", gap: 8, marginTop: 12 }}>
                <strong>Qikink provider mapping</strong>
                <input name="providerSku" required placeholder="Qikink SKU" aria-label="Qikink SKU" />
                <input name="providerVariantReference" placeholder="Qikink provider variant reference" aria-label="Qikink variant reference" />
                <button type="submit">Save Qikink mapping</button>
              </form>
            </div>
          ))}

          <button type="button" onClick={() => void changePublication(product.id, product.status === "ACTIVE" ? "unpublish" : "publish")} style={{ marginTop: 16 }}>
            {product.status === "ACTIVE" ? "Unpublish" : "Publish"}
          </button>
        </article>
      ))}
    </main>
  );
}
