import { useMemo, useState } from 'react'
import { Download, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'
import { useAttendanceReport } from '@/hooks/use-attendance'
import { useDeleteStudent } from '@/hooks/use-groups'
import { exportStudentMatrix } from '@/lib/report'
import type { ReportCell } from '@/lib/report'
import { curriculumForClass, translateClassName, weekForDate } from '@/lib/calendar'
import { ImportStudents } from '@/components/import-admin'
import { Spinner } from '@/components/spinner'
import { SortableTableHead, toggleSort, type SortState } from '@/components/sortable-table-head'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface WeekColumn {
  key: string
  label: string
  title: string
  sort: number
}

type StudentSortKey = 'name' | 'email' | 'class' | 'group'

function compareStudents(
  a: { full_name: string; email: string; class_name: string; group_name: string },
  b: { full_name: string; email: string; class_name: string; group_name: string },
  sort: SortState<StudentSortKey>,
): number {
  const dir = sort.dir === 'asc' ? 1 : -1
  switch (sort.key) {
    case 'email':
      return dir * a.email.localeCompare(b.email, undefined, { sensitivity: 'base' })
    case 'class':
      return (
        dir * a.class_name.localeCompare(b.class_name, undefined, { sensitivity: 'base' }) ||
        a.group_name.localeCompare(b.group_name, undefined, { numeric: true })
      )
    case 'group':
      return dir * a.group_name.localeCompare(b.group_name, undefined, { numeric: true })
    case 'name':
    default:
      return dir * a.full_name.localeCompare(b.full_name, undefined, { sensitivity: 'base', numeric: true })
  }
}

export function StudentsReport({ classFilter }: { classFilter: string }) {
  const [exporting, setExporting] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortState<StudentSortKey>>({ key: 'name', dir: 'asc' })
  const isAll = classFilter === 'all'
  const reportQ = useAttendanceReport(isAll ? undefined : classFilter)
  const del = useDeleteStudent()
  const report = reportQ.data
  const { profile } = useAuth()
  const iAmSuper = profile?.role === 'super_admin'

  // 搜索(姓名/邮箱/班级/组)+ 按选定的列排序(点表头切换)
  const visibleStudents = useMemo(() => {
    const list = report?.students ?? []
    const q = query.trim().toLowerCase()
    const filtered = q
      ? list.filter(
          (s) =>
            s.full_name.toLowerCase().includes(q) ||
            s.email.toLowerCase().includes(q) ||
            s.class_name.toLowerCase().includes(q) ||
            s.group_name.toLowerCase().includes(q),
        )
      : list
    return [...filtered].sort((a, b) => compareStudents(a, b, sort))
  }, [report, query, sort])

  // 把每条记录的日期映射成「周次」(按学生所属课程)，只保留有数据的周列
  const { columns, cellByStudent } = useMemo(() => {
    const colMap = new Map<string, WeekColumn>()
    const byStudent: Record<string, Record<string, ReportCell>> = {}
    for (const s of visibleStudents) {
      const cur = curriculumForClass(s.class_name)
      const dateCells = report?.cells[s.id] ?? {}
      const dest: Record<string, ReportCell> = {}
      for (const [dateISO, cell] of Object.entries(dateCells)) {
        const wk = cur ? weekForDate(cur, dateISO) : null
        const col: WeekColumn =
          wk !== null
            ? { key: `w${wk}`, label: `Mg ${wk}`, title: `Minggu ${wk} · ${dateISO}`, sort: wk }
            : {
                key: `d${dateISO}`,
                label: dateISO.slice(5),
                title: dateISO,
                sort: 1000 + (Date.parse(dateISO) || 0) / 8.64e7,
              }
        colMap.set(col.key, col)
        dest[col.key] = cell
      }
      byStudent[s.id] = dest
    }
    const columns = [...colMap.values()].sort((a, b) => a.sort - b.sort)
    return { columns, cellByStudent: byStudent }
  }, [visibleStudents, report])

  async function onExport() {
    setExporting(true)
    try {
      const n = await exportStudentMatrix({
        classId: classFilter === 'all' ? undefined : classFilter,
        fileName: 'students-report.xlsx',
      })
      toast.success(`${n} siswa berhasil diekspor untuk semua minggu`)
    } catch (e) {
      toast.error(`Ekspor gagal: ${(e as Error).message}`)
    } finally {
      setExporting(false)
    }
  }

  function onDelete(s: { id: string; full_name: string }) {
    if (!window.confirm(`Hapus siswa "${s.full_name}"? Ini juga menghapus catatan absensinya.`))
      return
    del.mutate(s.id, {
      onSuccess: () => toast.success('Siswa dihapus'),
      onError: (e) => toast.error(`Gagal: ${(e as Error).message}`),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {isAll ? (
          <p className="text-muted-foreground text-sm">Pilih kelas di atas untuk melihat absensi dan mengekspor.</p>
        ) : (
          <Input
            placeholder="Cari siswa…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-xs"
          />
        )}
        <div className="flex items-center gap-2">
          {iAmSuper && (
            <Button
              variant={showImport ? 'secondary' : 'outline'}
              onClick={() => setShowImport((v) => !v)}
            >
              <Upload className="size-4" /> Impor CSV
            </Button>
          )}
          {!isAll && (
            <Button variant="outline" onClick={() => void onExport()} disabled={exporting}>
              <Download className="size-4" /> {exporting ? 'Mengekspor…' : 'Ekspor Excel'}
            </Button>
          )}
        </div>
      </div>

      {iAmSuper && showImport && <ImportStudents />}

      {isAll ? (
        <p className="text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm">
          Pilih kelas dari filter di atas untuk melihat matriks absensi per minggu dan
          mengekspornya ke Excel. Matriksnya per kelas — tiap kelas punya kalender mingguan sendiri,
          jadi minggunya hanya sejajar di dalam satu kelas yang sama.
        </p>
      ) : reportQ.isLoading ? (
        <Spinner />
      ) : !report || report.students.length === 0 ? (
        <p className="text-muted-foreground text-sm">Belum ada siswa di kelas ini.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead
                  label="Siswa"
                  sortKey="name"
                  sort={sort}
                  onSort={(k) => setSort((s) => toggleSort(s, k))}
                  className="bg-background sticky left-0 whitespace-nowrap"
                />
                <SortableTableHead
                  label="Email"
                  sortKey="email"
                  sort={sort}
                  onSort={(k) => setSort((s) => toggleSort(s, k))}
                  className="whitespace-nowrap"
                />
                <SortableTableHead
                  label="Kelas"
                  sortKey="class"
                  sort={sort}
                  onSort={(k) => setSort((s) => toggleSort(s, k))}
                  className="whitespace-nowrap"
                />
                <SortableTableHead
                  label="Grup"
                  sortKey="group"
                  sort={sort}
                  onSort={(k) => setSort((s) => toggleSort(s, k))}
                  className="whitespace-nowrap"
                />
                {columns.map((c) => (
                  <TableHead key={c.key} className="text-center whitespace-nowrap" title={c.title}>
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleStudents.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4 + columns.length}
                    className="text-muted-foreground text-center text-sm"
                  >
                    Tidak ada yang cocok.
                  </TableCell>
                </TableRow>
              ) : (
                visibleStudents.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="bg-background sticky left-0 font-medium whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        {s.full_name}
                        {iAmSuper && (
                          <button
                            type="button"
                            onClick={() => onDelete(s)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label={`Hapus ${s.full_name}`}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{s.email}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {translateClassName(s.class_name)}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{s.group_name}</TableCell>
                    {columns.map((c) => {
                      const cell = cellByStudent[s.id]?.[c.key]
                      const note = cell?.note ?? ''
                      const score = cell?.score ?? null
                      const display =
                        score !== null ? (
                          score
                        ) : note ? (
                          '✎'
                        ) : (
                          <span className="text-muted-foreground/40">·</span>
                        )
                      return (
                        <TableCell key={c.key} className="text-center tabular-nums">
                          {note ? (
                            <span
                              className="cursor-help underline decoration-dotted underline-offset-2"
                              title={note}
                            >
                              {display}
                            </span>
                          ) : (
                            display
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {!isAll && (
        <p className="text-muted-foreground text-xs">
          Kolom adalah minggu program (Mg N) — arahkan kursor ke judul kolom untuk melihat
          tanggalnya. Sel menunjukkan skor Contribution (0–3); ✎ = ada catatan (arahkan kursor
          untuk membaca); · = belum dinilai. Excel yang diekspor pakai satu sheet; tiap minggu
          mencakup dua kolom — Score dan Remark.
        </p>
      )}
    </div>
  )
}
