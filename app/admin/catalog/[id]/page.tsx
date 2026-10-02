import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/authorization";
import { getCatalogProduct } from "@/lib/admin/catalog";
import { CatalogProductForm } from "@/components/admin/catalog/catalog-product-form";
import { CatalogAction } from "@/components/admin/catalog/catalog-action";
import { CatalogVariantManager } from "@/components/admin/catalog/catalog-variant-manager";
import { CatalogMediaManager } from "@/components/admin/catalog/catalog-media-manager";
import { CatalogProviderMappingManager } from "@/components/admin/catalog/catalog-provider-mapping-manager";

type Product={id:string;title:string;slug:string;description:string|null;shortDescription:string|null;price:string;compareAtPrice:string|null;currency:string;seoTitle:string|null;seoDescription:string|null;status:"DRAFT"|"ACTIVE"|"ARCHIVED";updatedAt:string;variants:Array<{id:string;sku:string;displayName:string|null;size:string|null;color:string|null;price:string|null;status:"ACTIVE"|"INACTIVE";updatedAt:string}>;images:Array<{id:string;url:string;isPrimary:boolean;altText:string|null;sortOrder:number}>};
type MappingGroup={variantId:string;mappings:Array<{id:string;providerId:string;providerSku:string;active:boolean}>};
type ProductData={product:Product;providerMappings:MappingGroup[]};

export default async function CatalogProductPage({params}:{params:Promise<{id:string}>}){
 const context=await requireAdmin(undefined,"catalog.read");const id=(await params).id;let data:ProductData;
 try{data=await getCatalogProduct(context,id) as ProductData}catch{notFound()}
 const p=data.product;
 return <section className="space-y-8"><header className="flex flex-wrap items-end justify-between gap-4"><div><Link href="/admin/catalog" className="font-bold underline">← Catalog</Link><p className="mt-5 text-sm font-black uppercase tracking-[0.2em]">{p.status}</p><h2 className="text-4xl font-black uppercase">{p.title}</h2><p className="mt-2">{p.slug}</p></div><div className="flex flex-wrap gap-2">{context.permissions.has("catalog.publish")&&p.status==="DRAFT"&&<CatalogAction endpoint={"/api/admin/catalog/products/"+id+"/publish"} label="Publish" reasonRequired expectedUpdatedAt={p.updatedAt}/>} {context.permissions.has("catalog.publish")&&p.status==="ACTIVE"&&<CatalogAction endpoint={"/api/admin/catalog/products/"+id+"/unpublish"} label="Unpublish" reasonRequired expectedUpdatedAt={p.updatedAt}/>} {context.permissions.has("catalog.archive")&&p.status!=="ARCHIVED"&&<CatalogAction endpoint={"/api/admin/catalog/products/"+id+"/archive"} label="Archive" reasonRequired expectedUpdatedAt={p.updatedAt} tone="red"/>} {context.permissions.has("catalog.publish")&&p.status==="ARCHIVED"&&<CatalogAction endpoint={"/api/admin/catalog/products/"+id+"/restore"} label="Restore" reasonRequired expectedUpdatedAt={p.updatedAt}/>}</div></header>
 <CatalogProductForm mode="edit" product={p}/>
 <section className="border-4 border-black bg-white p-5"><h3 className="text-xl font-black uppercase">Variants</h3><div className="mt-4"><CatalogVariantManager productId={p.id} variants={p.variants} canManage={context.permissions.has("catalog.update")}/></div></section>
 <section className="border-4 border-black bg-white p-5"><h3 className="text-xl font-black uppercase">Media</h3><div className="mt-4"><CatalogMediaManager productId={p.id} images={p.images} canManage={context.permissions.has("catalog.media.manage")}/></div></section>
 <section className="border-4 border-black bg-white p-5"><h3 className="text-xl font-black uppercase">Provider mappings</h3><p className="mt-2 text-sm">Fulfillment mappings remain provider-specific and never replace the canonical 4HRS+ Store SKU.</p><div className="mt-4"><CatalogProviderMappingManager groups={data.providerMappings} canManage={context.permissions.has("catalog.provider_mapping.manage")}/></div></section>
 </section>;
}
