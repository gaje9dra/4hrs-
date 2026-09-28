export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="fixed left-4 top-4 z-[100] -translate-y-[calc(100%+1rem)] border-2 border-border bg-primary-yellow px-4 py-3 text-sm font-900 uppercase tracking-widest text-foreground no-underline shadow-hard-sm transition-transform duration-(--motion-fast) ease-(--motion-ease) focus-visible:translate-y-0"
    >
      Skip to main content
    </a>
  )
}
