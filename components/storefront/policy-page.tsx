import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { getPolicyPage } from "@/lib/policies/content";
import { absoluteSiteUrl } from "@/config/site";

export function policyMetadata(slug: string): Metadata {
  const policy = getPolicyPage(slug);
  if (!policy) return { title: "Page not found", robots: { index: false, follow: false } };
  const canonical = absoluteSiteUrl(`/${policy.slug}`);
  return {
    title: policy.title,
    description: policy.description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: { title: policy.title, description: policy.description, url: canonical, type: "article", siteName: "4HRS+" },
  };
}

const RELATED_LINKS: Record<string, Array<{ label: string; href: string }>> = {
  "refund-replacement": [{ label: "Shipping & Delivery", href: "/shipping" }, { label: "Contact Support", href: "/contact" }, { label: "Frequently Asked Questions", href: "/faq" }],
  shipping: [{ label: "Refund & Replacement", href: "/refund-replacement" }, { label: "Cancellation Policy", href: "/cancellation" }, { label: "Contact Support", href: "/contact" }],
  terms: [{ label: "Privacy Policy", href: "/privacy" }, { label: "Refund & Replacement", href: "/refund-replacement" }, { label: "Shipping & Delivery", href: "/shipping" }],
  privacy: [{ label: "Contact Support", href: "/contact" }, { label: "Terms & Conditions", href: "/terms" }],
  cancellation: [{ label: "Shipping & Delivery", href: "/shipping" }, { label: "Refund & Replacement", href: "/refund-replacement" }, { label: "Contact Support", href: "/contact" }],
  contact: [{ label: "Refund & Replacement", href: "/refund-replacement" }, { label: "Privacy Policy", href: "/privacy" }, { label: "FAQ", href: "/faq" }],
  faq: [{ label: "Refund & Replacement", href: "/refund-replacement" }, { label: "Shipping & Delivery", href: "/shipping" }, { label: "Contact Support", href: "/contact" }],
};

export function PolicyPage({ slug }: { slug: string }) {
  const policy = getPolicyPage(slug);
  if (!policy) notFound();
  const links = RELATED_LINKS[slug] ?? [];

  return (
    <Container width="standard" className="py-8 sm:py-12 lg:py-16">
      <div className="mb-8 border-b-4 border-border pb-7 sm:mb-10 sm:pb-9">
        <p className="text-xs font-900 uppercase tracking-[0.22em] text-primary-blue">4HRS+ / Customer information</p>
        <h1 className="mt-3 max-w-4xl text-3xl font-900 uppercase leading-[0.98] tracking-[-0.04em] sm:text-4xl lg:text-5xl">{policy.title}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 sm:text-base">{policy.intro}</p>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-12">
        <div className="min-w-0 space-y-8 sm:space-y-10">
          {policy.sections.map((section, index) => (
            <section key={section.heading} aria-labelledby={`policy-section-${index}`} className="min-w-0">
              <h2 id={`policy-section-${index}`} className="text-xl font-900 uppercase leading-tight tracking-[-0.02em] sm:text-2xl">{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => <p key={paragraph} className="mt-3 max-w-3xl text-sm leading-7 text-foreground/90 sm:text-base">{paragraph}</p>)}
              {section.bullets ? <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-foreground/90 sm:text-base">{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul> : null}
            </section>
          ))}
          {slug === "contact" || slug === "refund-replacement" || slug === "cancellation" || slug === "shipping" || slug === "faq" ? (
            <div className="border-4 border-border bg-primary-yellow p-5 shadow-hard-sm sm:p-7">
              <p className="text-xs font-900 uppercase tracking-[0.18em]">Need help with an order?</p>
              <h2 className="mt-2 text-xl font-900 uppercase">Open a support case</h2>
              <p className="mt-2 text-sm leading-6">Include your order number and a clear description. Sign in is required. Do not include payment credentials or publish private evidence.</p>
              <Link href="/account/cases/new" className="motion-link mt-4 inline-flex min-h-12 items-center border-2 border-border bg-white px-5 py-3 text-sm font-900 uppercase text-foreground no-underline shadow-hard-sm hover:bg-primary-blue hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-blue">Contact Support <span aria-hidden="true" className="ml-3">→</span></Link>
            </div>
          ) : null}
        </div>

        <aside className="min-w-0 border-2 border-border bg-white p-5 shadow-hard-sm sm:p-6 lg:sticky lg:top-6">
          <h2 className="text-sm font-900 uppercase tracking-[0.12em]">Related information</h2>
          <nav aria-label="Related policy pages" className="mt-4">
            <ul className="space-y-3">
              {links.map((link) => <li key={link.href}><Link href={link.href} className="motion-link text-sm font-700 underline underline-offset-4 hover:bg-primary-yellow">{link.label}</Link></li>)}
            </ul>
          </nav>
          <div className="mt-6 border-t-2 border-border pt-4">
            <p className="text-xs leading-5 text-foreground/70">Policy text is general information, not legal advice. Applicable mandatory rights remain unaffected.</p>
          </div>
        </aside>
      </div>
    </Container>
  );
}
