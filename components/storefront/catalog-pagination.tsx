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
    <nav aria-label="Catalog pagination" className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t-2 border-border pt-6 lg:border-t-4">
      {previousPage ? (
        <Link href={buildHref(previousPage)} className="motion-link border-2 border-border bg-white px-4 py-3 text-sm font-900 uppercase no-underline shadow-hard-sm">
          Previous
        </Link>
      ) : <span />}
      <span className="text-sm font-900 uppercase">Page {pagination.page} of {pagination.totalPages}</span>
      {nextPage ? (
        <Link href={buildHref(nextPage)} className="motion-link border-2 border-border bg-white px-4 py-3 text-sm font-900 uppercase no-underline shadow-hard-sm lg:shadow-hard-md">
          Next
        </Link>
      ) : <span />}
    </nav>
  );
}
