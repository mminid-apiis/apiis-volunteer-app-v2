import { useMemo, useState } from 'react'
import { useAssignmentHistory } from '@/hooks/use-assignments'
import { translateClassName } from '@/lib/calendar'
import { Spinner } from '@/components/spinner'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/** 只读:历史上被「管理员指派 / 补位」到各组的人(每周三清理前的归档)。 */
export function AssignmentHistory() {
  const { data, isLoading } = useAssignmentHistory()
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = data ?? []
    if (!q) return all
    return all.filter((r) =>
      [r.week_start_date, r.class_name, r.group_name, r.volunteer_name, r.volunteer_email].some(
        (v) => (v ?? '').toLowerCase().includes(q),
      ),
    )
  }, [data, query])

  if (isLoading) return <Spinner />

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input
          placeholder="Cari berdasarkan minggu, kelas, grup, nama, atau email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
        />
        <span className="text-muted-foreground text-xs">{rows.length} catatan</span>
      </div>
      <p className="text-muted-foreground text-xs">
        Penugasan sementara (ditugaskan admin dan pengganti) diarsipkan tepat sebelum pembersihan
        mingguan hari Rabu. OBS daftar awal (asli) bersifat permanen — lihat Grup &amp; Penugasan.
      </p>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">Belum ada riwayat.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Minggu (Sen)</TableHead>
                <TableHead>Kelas</TableHead>
                <TableHead>Grup</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>OBS</TableHead>
                <TableHead className="whitespace-nowrap">Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="tabular-nums whitespace-nowrap">
                    {r.week_start_date}
                  </TableCell>
                  <TableCell>{r.class_name ? translateClassName(r.class_name) : '—'}</TableCell>
                  <TableCell>{r.group_name ?? '—'}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        r.source === 'coverage'
                          ? 'bg-green-100 font-normal text-green-900 dark:bg-green-900/40 dark:text-green-100'
                          : 'bg-blue-700 font-normal text-white'
                      }
                    >
                      {r.source === 'coverage' ? 'Pengganti' : 'Ditugaskan admin'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{r.volunteer_name ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {r.volunteer_email ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
