'use client'

import { useState } from 'react'
import { Heart, Menu, Search, ShoppingBag, UserRound, X } from 'lucide-react'
import { GeometricMark } from '@/components/geometry/geometric-mark'

const links = ['Shop', 'New Arrivals', 'T-Shirts', 'Shirts', 'Pants', 'Shoes', 'Accessories']

export function Header() {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-50 border-b-2 border-border lg:border-b-4 bg-background">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 lg:px-8">
        <a href="#top" className="flex items-center gap-2" aria-label="4HRS home">
          <GeometricMark className="h-10 w-14 scale-90" />
          <span className="text-2xl font-900 uppercase tracking-[-0.05em]">4HRS</span>
        </a>
        <nav className="hidden items-center gap-5 xl:flex" aria-label="Primary navigation">
          {links.map((link) => <a key={link} href="#" className="text-xs font-700 uppercase tracking-widest transition-colors hover:text-red">{link}</a>)}
        </nav>
        <div className="flex items-center gap-1">
          {[Search, Heart, UserRound, ShoppingBag].map((Icon, i) => <button key={i} type="button" aria-label={['Search','Wishlist','Account','Cart'][i]} className="hidden h-10 w-10 items-center justify-center rounded-full border-2 border-transparent transition-colors hover:border-border hover:bg-yellow md:flex"><Icon size={20} strokeWidth={2} /></button>)}
          <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-border bg-yellow md:hidden" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? 'Close navigation' : 'Open navigation'}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {open && <nav id="mobile-menu" className="border-t-4 border-border bg-white px-4 py-5 md:hidden" aria-label="Mobile navigation">
        {links.map((link, i) => <a key={link} href="#" onClick={() => setOpen(false)} className={`flex items-center justify-between border-b-2 border-border py-4 text-lg font-900 uppercase ${i % 3 === 0 ? 'text-red' : i % 3 === 1 ? 'text-blue' : ''}`}>{link}<span aria-hidden="true">↗</span></a>)}
      </nav>}
    </header>
  )
}