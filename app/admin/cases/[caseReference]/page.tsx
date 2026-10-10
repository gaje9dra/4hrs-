import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/authorization";
import { CaseDomainError } from "@/lib/cases/errors";
import { createCaseApplication } from "@/lib/cases/application";
import CaseDetailActions from "@/components/admin/case-detail-actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminCaseDetail({ params }: { params: Promise<{ caseReference: string }> }) {
  const context = await requireAdmin(undefined, "case.read");
  const { caseReference } = await params;
  const item = await createCaseApplication().getInternalCase(caseReference).catch((error: unknown) => {
    if (error instanceof CaseDomainError && error.code === "CASE_NOT_FOUND") notFound();
    throw error;
  });

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <Link href="/admin/cases" className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-amber-600">← Back to cases</Link>
      <header className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">{item.caseReference}</p>
            <h2 className="mt-2 break-words text-3xl font-extrabold tracking-tight sm:text-4xl">{item.title}</h2>
          </div>
          <span className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-700">{item.status.replaceAll("_", " ")}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-stone-600">
          <span className="rounded-md border border-stone-200 px-2.5 py-1.5">Priority: {item.priority}</span>
          <span className="rounded-md border border-stone-200 px-2.5 py-1.5">Category: {item.category.replaceAll("_", " ")}</span>
          {item.orderReference && <span className="rounded-md border border-stone-200 px-2.5 py-1.5">Order: {item.orderReference}</span>}
        </div>
        <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-7 text-stone-700">{item.description}</p>
      </header>

      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-bold">Linked records</h3>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            ["Order", item.orderReference],
            ["Shipment", item.shipmentReference],
            ["Return", item.returnReference],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-stone-50 p-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</dt>
              <dd className="mt-1 break-all text-sm font-semibold text-stone-800">{value || "Not linked"}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <CaseDetailActions caseReference={item.caseReference} status={item.status} canUpdate={context.permissions.has("case.update")} canResolve={context.permissions.has("case.resolve")} />
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-bold">Internal notes</h3>
        <p className="mt-1 text-sm text-stone-500">Visible to authorized administrators only.</p>
        {item.notes.length ? (
          <ol className="mt-4 space-y-3">
            {item.notes.map((note) => (
              <li key={note.id} className="rounded-lg border border-stone-200 p-4">
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-stone-800">{note.body}</p>
                <p className="mt-2 text-xs text-stone-500">{new Date(note.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
              </li>
            ))}
          </ol>
        ) : <p className="mt-4 rounded-lg bg-stone-50 p-4 text-sm text-stone-500">No internal notes have been added.</p>}
      </section>
    </section>
  );
}
