import { ArrowRight, Box, CreditCard, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Shape } from '@/components/geometry/geometric-mark'

const futureSystems = [
  { icon: Box, title: 'Fulfillment', body: 'Provider-neutral boundaries ready for Qikink, Printrove, Printful, Printify, manual fulfillment and own inventory.' },
  { icon: CreditCard, title: 'Payments', body: 'A payment adapter boundary ready for Razorpay, PayU, Stripe and additional providers.' },
  { icon: Truck, title: 'Shipping', body: 'A shipping adapter boundary for Shiprocket, Delhivery, DTDC, Blue Dart and manual shipping.' },
]

export default function Home() {
  return <div id="top" className="overflow-hidden">
    <section className="bauhaus-grid relative border-b-2 border-border lg:border-b-4">
      <div className="mx-auto grid min-h-[calc(100vh-76px)] max-w-7xl items-center gap-12 px-4 py-12 sm:py-16 lg:grid-cols-[1.15fr_.85fr] lg:px-8 lg:py-24">
        <div className="relative z-10">
          <div className="mb-7 flex items-center gap-3 text-xs font-900 uppercase tracking-[0.25em]"><Shape type="circle" color="red" size="sm" /> Bauhaus / Fashion / 01</div>
          <h1 className="max-w-4xl uppercase leading-[.86] tracking-[-.055em]">Built for<br /><span className="text-primary-red">the bold.</span></h1>
          <p className="mt-8 max-w-xl text-lg font-500 leading-7 lg:text-xl">A modern fashion storefront foundation where geometry, color and commerce are designed as one system.</p>
          <div className="mt-9 flex flex-wrap gap-4"><Button variant="primary">Explore the system <ArrowRight className="ml-2" size={18} /></Button><Button variant="outline">View categories</Button></div>
        </div>
        <div className="relative min-h-[360px] lg:min-h-[520px]" aria-label="Geometric Bauhaus composition" role="img">
          <div className="absolute right-2 top-2 h-48 w-48 rounded-full bg-primary-red sm:h-64 sm:w-64 lg:right-10 lg:top-0 lg:h-80 lg:w-80" />
          <div className="absolute bottom-5 left-2 h-48 w-48 bg-primary-blue sm:h-64 sm:w-64 lg:bottom-10 lg:left-8 lg:h-72 lg:w-72" />
          <div className="absolute left-[35%] top-[35%] h-40 w-40 rotate-12 bg-primary-yellow clip-triangle sm:h-56 sm:w-56 lg:h-64 lg:w-64" />
          <div className="absolute bottom-0 right-0 h-20 w-44 border-4 border-border bg-white shadow-hard-lg sm:h-28 sm:w-60" />
        </div>
      </div>
    </section>
    <div className="overflow-hidden border-b-2 border-border lg:border-b-4 bg-primary-yellow py-3 text-sm font-900 uppercase tracking-[.2em]">
      <div className="marquee-track flex w-max gap-12"><span>GEOMETRY / UTILITY / EXPRESSION / 4HRS / </span><span>GEOMETRY / UTILITY / EXPRESSION / 4HRS / </span></div>
    </div>
    <section className="mx-auto max-w-7xl px-4 py-12 sm:py-16 lg:px-8 lg:py-24">
      <div className="mb-12 grid gap-5 lg:grid-cols-[1fr_2fr] lg:items-end"><div><p className="text-xs font-900 uppercase tracking-[.25em] text-primary-blue">Foundation / 01</p><h2 className="mt-3 uppercase leading-none sm:text-5xl">The system<br />comes first.</h2></div><p className="max-w-2xl text-base leading-7 lg:text-lg">Every future storefront surface will inherit the same deliberate geometry: square edges, strong borders, hard shadows, controlled color and mechanical motion.</p></div>
      <div className="grid gap-8 md:grid-cols-3">{[
        ['01', 'Color blocking', 'Red, blue and yellow are functional signals, not decoration.'],
        ['02', 'Hard geometry', 'Square cards, binary radius rules and decisive black borders.'],
        ['03', 'Mechanical motion', 'Fast, tactile interactions that feel physical rather than floaty.'],
      ].map(([number, title, body], i) => <Card key={number} className="min-h-64 overflow-hidden"><div className="flex items-start justify-between"><span className="text-5xl font-900 leading-none">{number}</span><Shape type={i === 0 ? 'circle' : i === 1 ? 'square' : 'triangle'} color={(['red','blue','yellow'] as const)[i]} size="lg" /></div><h3 className="mt-12 uppercase">{title}</h3><p className="mt-3 text-sm leading-6">{body}</p></Card>)}</div>
    </section>
    <section className="border-y-2 border-border lg:border-y-4 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:py-16 lg:px-8 lg:py-24"><div className="mb-10 max-w-2xl"><p className="text-xs font-900 uppercase tracking-[.25em] text-primary-red">Architecture / Ready</p><h2 className="mt-3 uppercase leading-none sm:text-5xl">Built to grow<br />without rewrites.</h2></div><div className="grid gap-8 md:grid-cols-3">{futureSystems.map(({icon: Icon, title, body}, i) => <div key={title} className="border-4 border-border bg-background p-6 shadow-hard-md"><div className="mb-10 flex h-12 w-12 items-center justify-center border-2 border-border bg-primary-yellow"><Icon size={24} strokeWidth={3} /></div><p className="text-xs font-900 uppercase tracking-widest text-primary-blue">Layer 0{i + 1}</p><h3 className="mt-2 uppercase"> {title}</h3><p className="mt-3 text-sm leading-6">{body}</p></div>)}</div></div>
    </section>
    <section className="mx-auto max-w-7xl px-4 py-12 sm:py-16 lg:px-8 lg:py-24"><div className="relative overflow-hidden border-4 border-border bg-primary-blue p-8 text-white shadow-hard-lg sm:p-12 lg:p-16"><div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary-red" /><div className="absolute bottom-[-55px] left-[45%] h-32 w-32 rotate-12 bg-primary-yellow clip-triangle" /><div className="relative max-w-3xl"><p className="text-xs font-900 uppercase tracking-[.25em] text-primary-yellow">Next phase / Storefront</p><h2 className="mt-4 uppercase leading-[.9] sm:text-6xl">Make the<br />store move.</h2><p className="mt-6 max-w-xl text-base leading-7 text-white/90">The foundation is deliberately ready for products, catalog management, cart, checkout and provider integrations in later phases.</p><Button variant="yellow" className="mt-8">Continue building <ArrowRight className="ml-2" size={18} /></Button></div></div></section>
  </div>
}
