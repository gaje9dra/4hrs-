"use client";
type Mapping={id:string;providerId:string;providerSku:string;active:boolean};
type Group={variantId:string;mappings:Mapping[]};
type Variant={id:string;sku:string};

export function CatalogProviderMappingManager({groups,variants}:{groups:Group[];variants:Variant[];canManage:boolean}) {
 const groupByVariant=new Map(groups.map((group)=>[group.variantId,group]));
 return <div className="space-y-4">
  {variants.map((variant)=>{
   const group=groupByVariant.get(variant.id);
   const qikink=group?.mappings.find((mapping)=>mapping.providerId==="qikink");
   const providerSku=qikink?.providerSku||variant.sku;
   return <section key={variant.id} className="border-2 border-black p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <strong>Variant {variant.sku}</strong>
      <span className="text-xs font-bold uppercase">{qikink?.active?"ACTIVE":"AUTO"}</span>
    </div>
    <div className="mt-2 grid gap-2 md:grid-cols-2">
      <div className="border-2 border-black p-2"><span className="block text-xs font-bold uppercase">Provider</span><span>Qikink</span></div>
      <div className="border-2 border-black p-2"><span className="block text-xs font-bold uppercase">Provider SKU</span><span>{providerSku}</span></div>
    </div>
    <p className="mt-2 text-xs">Automatically mapped from the canonical 4HRS+ variant SKU. No manual SKU entry is required.</p>
   </section>
  })}
  {!variants.length&&<p className="border-2 border-black p-3 text-sm font-bold uppercase">No variants configured yet.</p>}
 </div>;
}