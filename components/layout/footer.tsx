import { GeometricMark } from '@/components/geometry/geometric-mark'

const columns = [
  ['Shop', 'New arrivals', 'T-shirts', 'Shirts', 'Pants'],
  ['Support', 'Contact', 'Shipping', 'Returns', 'FAQ'],
  ['Policies', 'Privacy', 'Terms', 'Refunds', 'Cookies'],
]

export function Footer() {
  return <footer className="border-t-4 border-border bg-foreground text-white">
    <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8 lg:py-20">
      <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr]">
        <div>
          <GeometricMark className="mb-5" />
          <p className="max-w-sm text-3xl font-900 uppercase leading-none">Wear the idea.<br />Make it yours.</p>
          <p className="mt-5 max-w-sm text-sm leading-6 text-white/70">A geometric fashion system built for bold pieces, clear choices and everyday movement.</p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {columns.map(([title, ...items]) => <div key={title}><h2 className="mb-4 text-xs font-900 uppercase tracking-[0.2em] text-yellow">{title}</h2><ul className="space-y-3">{items.map((item) => <li key={item}><a href="#" className="text-sm font-500 uppercase hover:text-yellow">{item}</a></li>)}</ul></div>)}
        </div>
      </div>
      <div className="mt-12 border-t-2 border-white/30 pt-5 text-xs font-700 uppercase tracking-widest text-white/60">© 2026 4HRS. All rights reserved.</div>
    </div>
  </footer>
}