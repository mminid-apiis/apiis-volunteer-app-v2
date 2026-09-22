/* eslint-disable react-refresh/only-export-components */
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export interface SortState<K extends string> {
  key: K
  dir: 'asc' | 'desc'
}

/** Klik header untuk sortir; klik lagi untuk balik arah, kolom baru selalu mulai dari a→z. */
export function toggleSort<K extends string>(current: SortState<K> | null, key: K): SortState<K> {
  if (current?.key === key) return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
  return { key, dir: 'asc' }
}

export function SortableTableHead<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  className,
  align = 'left',
}: {
  label: string
  sortKey: K
  sort: SortState<K> | null
  onSort: (key: K) => void
  className?: string
  align?: 'left' | 'center'
}) {
  const active = sort?.key === sortKey
  const Icon = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 hover:text-foreground',
          align === 'center' && 'w-full justify-center',
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
        <Icon className={cn('size-3.5', !active && 'opacity-50')} />
      </button>
    </TableHead>
  )
}
