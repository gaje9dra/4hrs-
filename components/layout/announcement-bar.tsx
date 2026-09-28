import Link from 'next/link'

type AnnouncementBarProps = {
  message: string
  href?: string
  linkLabel?: string
}

export function AnnouncementBar({ message, href, linkLabel }: AnnouncementBarProps) {
  const content = (
    <>
      <span>{message}</span>
      {href && linkLabel ? <span className="underline decoration-2 underline-offset-4">{linkLabel}</span> : null}
    </>
  )

  return (
    <div className="border-b-2 border-border bg-primary-yellow text-foreground">
      <div className="mx-auto flex min-h-10 max-w-7xl items-center justify-center gap-3 px-4 py-2 text-center text-xs font-900 uppercase tracking-[0.12em] sm:px-6 lg:px-8">
        {href && linkLabel ? (
          <Link href={href} className="inline-flex min-h-8 items-center gap-3 no-underline hover:bg-white">{content}</Link>
        ) : (
          <p className="text-xs font-900 uppercase tracking-[0.12em]">{content}</p>
        )}
      </div>
    </div>
  )
}
