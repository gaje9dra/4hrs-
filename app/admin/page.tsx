"use client";

import { useEffect, useState } from "react";

type Product = { id: string; title: string; slug: string; status: string; price: string | number; variants?: Array<{ id: string; sku: string; size: string | null; color: string | null; status: string }> };

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? "Request failed.");
  return body;
}

export default function AdminCatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [price, setPrice] = useState("");
  const [sku, setSku] = useState("");
  const [qikinkSku, setQikinkSku] = useState("");

  async function load() {
    try {
      const data = await api("/api/admin/catalog?status=DRAFT");
      setProducts(data.items ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load catalog.");
    }
  }

  useEffect(() => { void load(); }, []);

  async function createProduct(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      const created = await api("/api/admin/catalog", {
        method: "POST",
        body: JSON.stringify({
          title,
          slug,
          description: "",
          shortDescription: "",
          status: "DRAFT",
          price,
          compareAtPrice: null,
          currency: "INR",
          seoTitle: title,
          seoDescription: ""
        })
      });
      await api("/api/admin/catalog/variants", {
        method: "POST",
        body: JSON.stringify({
          productId: created.product.id,
          sku,
          displayName: sku,
          size: null,
          color: null,
          status: "ACTIVE",
          price: null,
          compareAtPrice: null
        })
      });
      setTitle(""); setSlug(""); setPrice(""); setSku("");
      setMessage("Product and variant created. Add the Qikink mapping before publishing.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create product.");
    }
  }

  async function saveMapping(variantId: string) {
    try {
      await api("/api/admin/catalog/mappings", {
        method: "POST",
        body: JSON.stringify({ variantId, providerId: "qikink", providerSku: qikinkSku, active: true })
      });
      setQikinkSku("");
      setMessage("Qikink mapping saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save mapping.");
    }
  }

  async function publish(productId: string) {
    try {
      await api("/api/admin/catalog/publish", { method: "POST", body: JSON.stringify({ productId, action: "publish" }) });
      setMessage("Product published.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to publish product.");
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 32 }}>
      <h1>4HRS+ Catalog Admin</h1>
      <p>4HRS+ owns the storefront catalog. Qikink is fulfillment only.</p>
      <form onSubmit={createProduct} style={{ display: "grid", gap: 10, maxWidth: 520 }}>
        <input required placeholder="Product title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input required placeholder="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
        <input required placeholder="Selling price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        <input required placeholder="4HRS+ Store SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
        <button type="submit">Create product + variant</button>
      </form>
      {message && <p>{message}</p>}
      <section>
        <h2>Draft products</h2>
        {products.map((product) => (
          <article key={product.id} style={{ border: "1px solid #ddd", padding: 16, marginTop: 12 }}>
            <strong>{product.title}</strong> — {product.status}
            {(product.variants ?? []).map((variant) => (
              <div key={variant.id} style={{ marginTop: 8 }}>
                <div>Store SKU: <code>{variant.sku}</code></div>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <input placeholder="Qikink SKU" value={qikinkSku} onChange={(e) => setQikinkSku(e.target.value)} />
                  <button type="button" onClick={() => void saveMapping(variant.id)}>Save Qikink mapping</button>
                  <button type="button" onClick={() => void publish(product.id)}>Publish</button>
                </div>
              </div>
            ))}
          </article>
        ))}
      </section>
    </main>
  );
}
