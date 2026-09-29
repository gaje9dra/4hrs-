import Link from "next/link";

type Pagination = { page: number; totalPages: number; hasNextPage: boolean };

export function CatalogPagination({
  pagination,
  buildHref,
}: {
  pagination: Pagination;
  buildHref: (page: number) => string;
}) {
  const previousPage = pagination.page > 1 ? pagination.page - 1 : null;
  const nextPage = pagination.hasNextPage ? pagination.page + 1 : null;

  if (!previousPage && !nextPage) return null;

  return (
    <nav aria-label="Catalog pagination" className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t-4 border-border pt-6">
      {previousPage ? (
        <Link href={buildHref(previousPage)} rel="prev" aria-label={"Go to page " + previousPage} className="motion-press min-h-12 border-2 border-border bg-white px-5 py-3 text-sm font-900 uppercase no-underline shadow-hard-sm focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2">
          Previous
        </Link>
      ) : <span aria-hidden="true" />}

      <span aria-current="page" className="border-2 border-border bg-primary-yellow px-4 py-3 text-sm font-900 uppercase">
        Page {pagination.page} of {pagination.totalPages}
      </span>

      {nextPage ? (
        <Link href={buildHref(nextPage)} rel="next" aria-label={"Go to page " + nextPage} className="motion-press min-h-12 border-2 border-border bg-white px-5 py-3 text-sm font-900 uppercase no-underline shadow-hard-sm focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2">
          Next
        </Link>
      ) : <span aria-hidden="true" />}
    </nav>
  );
}
