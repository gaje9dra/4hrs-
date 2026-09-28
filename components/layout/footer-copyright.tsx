export function FooterCopyright({ year = new Date().getFullYear() }: { year?: number }) {
  return (
    <p className="text-xs font-700 uppercase tracking-[0.12em] text-white/65">
      © {year} 4HRS. All rights reserved.
    </p>
  )
}
