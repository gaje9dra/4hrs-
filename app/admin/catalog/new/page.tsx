import Link from "next/link";
import { requireAdmin } from "@/lib/admin/authorization";
import { CatalogProductForm } from "@/components/admin/catalog/catalog-product-form";
import { listCatalogCategories } from "@/lib/admin/catalog";
export default async function NewCatalogProductPage(){const context=await requireAdmin(undefined,"catalog.create");const categories=await listCatalogCategories(context) as Array<{id:string;name:string;slug:string;status:"ACTIVE"|"DRAFT"|"ARCHIVED";parentId:string|null}>;return <section className="mx-auto max-w-4xl space-y-6"><header><Link href="/admin/catalog" className="font-bold underline">← Catalog</Link><p className="mt-5 text-sm font-black uppercase tracking-[0.2em]">Catalog / Product</p><h2 className="text-4xl font-black uppercase">New draft</h2><p className="mt-2">Saving creates a draft. Publication is a separate privileged lifecycle action.</p></header><CatalogProductForm mode="create"/></section>}
