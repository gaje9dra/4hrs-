import { Input } from "@/components/ui/input";

export function SearchInput({ defaultValue = "", action = "/search" }: { defaultValue?: string; action?: string }) {
  return (
    <form method="get" action={action} role="search" className="grid gap-3 sm:grid-cols-[1fr_auto]">
      <label htmlFor="storefront-search" className="sr-only">Search products</label>
      <Input id="storefront-search" name="q" type="search" defaultValue={defaultValue} placeholder="SEARCH PRODUCTS, CATEGORIES, COLLECTIONS..." autoComplete="off" spellCheck={false} />
      <button type="submit" className="min-h-12 border-2 border-border bg-primary-red px-6 py-3 text-sm font-900 uppercase text-white shadow-hard-sm hover:bg-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2">
        Search
      </button>
    </form>
  );
}
