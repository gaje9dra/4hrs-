import type { HTMLAttributes, ReactNode } from 'react'
export type GridColumns = 1 | 2 | 3 | 4 | 5 | 6
const columns: Record<GridColumns, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4', 5: 'grid-cols-5', 6: 'grid-cols-6' }
const smColumns: Record<GridColumns, string> = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4', 5: 'sm:grid-cols-5', 6: 'sm:grid-cols-6' }
const lgColumns: Record<GridColumns, string> = { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6' }

export function Grid({ children, className = '', columns: count = 1, tabletColumns, desktopColumns, gap = 'gap-6', ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode; columns?: GridColumns; tabletColumns?: GridColumns; desktopColumns?: GridColumns; gap?: string }) {
  return <div className={['grid', columns[count], tabletColumns ? smColumns[tabletColumns] : '', desktopColumns ? lgColumns[desktopColumns] : '', gap, className].filter(Boolean).join(' ')} {...props}>{children}</div>
}
