import Link from "next/link";

type Props = {
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
};

function href(page: number, pageSize: number) {
  return `/account/orders?page=${page}&pageSize=${pageSize}`;
}

export function OrderPagination({ page, pageSize, totalPages, hasNextPage }: Props) {
  if (totalPages <= 1) return null;

  const previous = Math.max(1, page - 1);
  const next = page + 1;

  return (
    <nav aria-label="Order history pagination" className="flex flex-wrap items-center justify-between gap-3 border-t-4 border-border pt-5">
      <p className="text-xs font-900 uppercase tracking-[0.12em]" aria-live="polite">
        Page {page} of {totalPages}
      </p>
      <div className="flex flex-wrap gap-2">
        {page > 1 ? (
          <Link href={href(previous, pageSize)} className="inline-flex min-h-11 items-center border-2 border-border bg-white px-4 py-2 text-xs font-900 uppercase no-underline shadow-hard-sm hover:bg-primary-yellow focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2">
            Previous
          </Link>
        ) : null}
        {hasNextPage ? (
          <Link href={href(next, pageSize)} className="inline-flex min-h-11 items-center border-2 border-border bg-primary-yellow px-4 py-2 text-xs font-900 uppercase no-underline shadow-hard-sm hover:bg-white focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2">
            Next
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
