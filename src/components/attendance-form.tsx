import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useSaveAttendance } from '@/hooks/use-attendance'
import type { AttendanceUpsert } from '@/hooks/use-attendance'
import type { AttendanceRecord } from '@/types'
import type { GroupStudent } from '@/hooks/use-groups'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface RowState {
  contribution: number | null
  notes: string
}

interface Props {
  students: GroupStudent[]
  existing: AttendanceRecord[]
  groupId: string
  sessionDate: string
  volunteerId: string
}

const RUBRIC: {
  score: number
  dot: string
  title: string
  looksLike: string
  contribution: string
}[] = [
  {
    score: 0,
    dot: 'bg-muted-foreground',
    title: 'Tidak Berpartisipasi',
    looksLike: 'Kamera mati, tidak hadir, atau sama sekali diam, atau tidak mengikuti satu sesi.',
    contribution: 'Tidak ada.',
  },
  {
    score: 1,
    dot: 'bg-chart-4',
    title: 'Partisipasi Minimal',
    looksLike: 'Kamera menyala, tapi kebanyakan hanya menonton.',
    contribution: 'Mengulang perkataan orang lain, komentar di luar topik, atau menunjukkan kurang paham.',
  },
  {
    score: 2,
    dot: 'bg-brand',
    title: 'Partisipasi Memuaskan',
    looksLike: 'Kamera menyala, hadir, dan siap.',
    contribution:
      'Menjawab pertanyaan dengan benar, tapi sangat bergantung pada catatan/bacaan tanpa banyak pemikiran pribadi.',
  },
  {
    score: 3,
    dot: 'bg-brand-green',
    title: 'Partisipasi Sangat Baik',
    looksLike: 'Kamera menyala dan sangat terlibat sepanjang sesi.',
    contribution:
      'Membagikan ide orisinal, mengaitkan topik dengan kehidupan nyata atau pelayanan, dan membantu mendorong diskusi kelompok maju.',
  },
]

export function AttendanceForm({ students, existing, groupId, sessionDate, volunteerId }: Props) {
  const save = useSaveAttendance()

  // useState 初始化器从已有记录构建表单；父组件用 key={groupId:date} 控制重挂载。
  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const map: Record<string, RowState> = {}
    for (const s of students) {
      const ex = existing.find((e) => e.student_id === s.id)
      map[s.id] = { contribution: ex?.contribution ?? null, notes: ex?.notes ?? '' }
    }
    return map
  })

  // 自动保存:改动后防抖 ~1.2s 触发 upsert。rowsRef 始终保存最新值,供保存时读取。
  const rowsRef = useRef(rows)
  const timerRef = useRef<number | null>(null)
  const dirtyRef = useRef(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const buildPayload = useCallback(
    (): AttendanceUpsert[] =>
      students.map((s) => ({
        group_id: groupId,
        student_id: s.id,
        volunteer_id: volunteerId,
        session_date: sessionDate,
        contribution: rowsRef.current[s.id]?.contribution ?? null,
        notes: rowsRef.current[s.id]?.notes ?? '',
      })),
    [students, groupId, volunteerId, sessionDate],
  )

  const persist = useCallback(async () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setStatus('saving')
    try {
      await save.mutateAsync(buildPayload())
      dirtyRef.current = false
      setStatus('saved')
    } catch (e) {
      dirtyRef.current = true
      setStatus('error')
      toast.error(`Gagal menyimpan: ${(e as Error).message}`)
    }
  }, [save, buildPayload])

  function update(studentId: string, patch: Partial<RowState>) {
    const next = { ...rowsRef.current, [studentId]: { ...rowsRef.current[studentId], ...patch } }
    rowsRef.current = next
    setRows(next)
    dirtyRef.current = true
    setStatus('saving')
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => void persist(), 1200)
  }

  // 卸载时:清定时器;若仍有未保存改动,做一次「尽力」补存(离开页面也不丢)。
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      if (dirtyRef.current) save.mutate(buildPayload())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-muted/40 rounded-md border p-3 text-sm">
        <p className="mb-2 font-medium">Panduan penilaian Contribution</p>
        <ul className="flex flex-col gap-2.5">
          {RUBRIC.map((r) => (
            <li key={r.score}>
              <p className="text-foreground flex items-center gap-2 font-medium">
                <span className={`inline-block size-2.5 shrink-0 rounded-full ${r.dot}`} />
                {r.score} – {r.title}
              </p>
              <p className="text-muted-foreground">
                <span className="text-foreground/80 font-medium">Ciri-cirinya:</span>{' '}
                {r.looksLike}
              </p>
              <p className="text-muted-foreground">
                <span className="text-foreground/80 font-medium">Contribution:</span>{' '}
                {r.contribution}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Siswa</TableHead>
              <TableHead className="w-40">Contribution</TableHead>
              <TableHead>Catatan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((s) => {
              const r = rows[s.id]
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.full_name}</TableCell>
                  <TableCell>
                    <Select
                      value={r.contribution === null ? 'none' : String(r.contribution)}
                      onValueChange={(v) =>
                        update(s.id, { contribution: v === 'none' ? null : Number(v) })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Belum dinilai</SelectItem>
                        <SelectItem value="0">0</SelectItem>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="3">3</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={r.notes}
                      onChange={(e) => update(s.id, { notes: e.target.value })}
                      placeholder="Opsional"
                      maxLength={200}
                      title="Maks 200 karakter"
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end gap-3">
        <span className="text-xs">
          {status === 'saving' && <span className="text-muted-foreground">Menyimpan…</span>}
          {status === 'saved' && <span className="text-muted-foreground">Semua perubahan tersimpan ✓</span>}
          {status === 'error' && (
            <span className="text-destructive">Gagal menyimpan — coba "Simpan sekarang"</span>
          )}
        </span>
        <Button variant="secondary" onClick={() => void persist()} disabled={save.isPending}>
          {save.isPending ? 'Menyimpan…' : 'Simpan sekarang'}
        </Button>
      </div>
    </div>
  )
}
