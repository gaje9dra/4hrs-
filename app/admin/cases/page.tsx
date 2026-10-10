import Link from "next/link";
import { requireAdmin } from "@/lib/admin/authorization";
import { createCaseApplication } from "@/lib/cases/application";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CasesAdmin() {
  await requireAdmin(undefined, "case.read");
  const data = await createCaseApplication().listInternalCases({ limit: 50 });

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <header className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">Customer support · Operations</p>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Operations cases</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">
          Investigate and resolve operational cases with audited actions. Orders, payments, fulfillment, shipping, returns and cancellations remain authoritative for their own state.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <div className="rounded-lg bg-stone-50 px-4 py-3"><p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Cases shown</p><p className="mt-1 text-2xl font-bold tabular-nums">{data.items.length}</p></div>
        </div>
      </header>

      <section aria-labelledby="cases-list-title" className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-200 px-5 py-4">
          <h3 id="cases-list-title" className="text-lg font-bold">Recent cases</h3>
          <p className="mt-1 text-sm text-stone-500">Select a case to view its history, internal notes and permitted actions.</p>
        </div>
        {data.items.length ? (
          <ul className="divide-y divide-stone-100">
            {data.items.map((item) => (
              <li key={item.caseReference}>
                <Link href={"/admin/cases/" + encodeURIComponent(item.caseReference)} className="block px-5 py-4 transition-colors hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-amber-600">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-bold text-stone-900">{item.title}</p>
                      <p className="mt-1 text-xs font-semibold text-stone-500">{item.caseReference}{item.orderReference ? " · Order " + item.orderReference : ""}</p>
                    </div>
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-700">{item.status.replaceAll("_", " ")}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-600">
                    <span className="rounded-md border border-stone-200 px-2 py-1">{item.priority}</span>
                    <span className="rounded-md border border-stone-200 px-2 py-1">{item.category.replaceAll("_", " ")}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-5 py-12 text-center">
            <p className="font-semibold text-stone-800">No operational cases found.</p>
            <p className="mt-1 text-sm text-stone-500">New cases will appear here when created by an authorized workflow.</p>
          </div>
        )}
      </section>
    </section>
  );
}
