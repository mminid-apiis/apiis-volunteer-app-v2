import { useMemo, useState } from 'react'
import { Download, Eraser, Lock, ShieldCheck, ShieldOff, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth, roleLabel } from '@/lib/auth'
import { exportVolunteers } from '@/lib/report'
import {
  useAssignments,
  useClearAssignments,
  useDeleteVolunteer,
  useSetUserRole,
  useVolunteerActivity,
} from '@/hooks/use-assignments'
import { useAllGroups } from '@/hooks/use-groups'
import { translateClassName } from '@/lib/calendar'
import { ImportVolunteers } from '@/components/import-admin'
import { Spinner } from '@/components/spinner'
import { SortableTableHead, toggleSort, type SortState } from '@/components/sortable-table-head'
import { Badge } from '@/components/ui/badge'
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

// 排序优先级：super_admin → admin → volunteer（同级再按姓名 a→z）
function roleRank(r: string): number {
  return r === 'super_admin' ? 0 : r === 'admin' ? 1 : 2
}

type VolunteerSortKey = 'name' | 'email' | 'role' | 'group' | 'sessions' | 'lastActive' | 'coverage'

function compareVolunteers(
  a: {
    volunteer_id: string
    full_name: string
    email: string | null
    role: string
    sessions_recorded: number
    last_active: string | null
    coverage_count: number
  },
  b: typeof a,
  sort: SortState<VolunteerSortKey>,
  firstGroupLabel: Map<string, string>,
): number {
  const dir = sort.dir === 'asc' ? 1 : -1
  switch (sort.key) {
    case 'email':
      return dir * (a.email ?? '').localeCompare(b.email ?? '', undefined, { sensitivity: 'base' })
    case 'group':
      return (
        dir *
        (firstGroupLabel.get(a.volunteer_id) ?? '').localeCompare(
          firstGroupLabel.get(b.volunteer_id) ?? '',
          undefined,
          { numeric: true },
        )
      )
    case 'sessions':
      return dir * (a.sessions_recorded - b.sessions_recorded)
    case 'lastActive':
      return dir * (a.last_active ?? '').localeCompare(b.last_active ?? '')
    case 'coverage':
      return dir * (a.coverage_count - b.coverage_count)
    case 'role':
      return (
        dir * (roleRank(a.role) - roleRank(b.role)) ||
        a.full_name.localeCompare(b.full_name, undefined, { sensitivity: 'base', numeric: true })
      )
    case 'name':
    default:
      return dir * a.full_name.localeCompare(b.full_name, undefined, { sensitivity: 'base', numeric: true })
  }
}

export function VolunteersReport({ classFilter }: { classFilter: string }) {
  const { user, profile } = useAuth()
  const iAmSuper = profile?.role === 'super_admin'
  const { data, isLoading } = useVolunteerActivity()
  const assignmentsQ = useAssignments()
  const groupsQ = useAllGroups()
  const del = useDeleteVolunteer()
  const setRole = useSetUserRole()
  const clearAssignments = useClearAssignments()
  const [query, setQuery] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [sort, setSort] = useState<SortState<VolunteerSortKey>>({ key: 'role', dir: 'asc' })

  // 每个志愿者的具体组名(客户端用 assignments + groups 拼出),带简短班级码,如 "6P · Group 1"
  const groupsByVolunteer = useMemo(() => {
    const groupById = new Map((groupsQ.data ?? []).map((g) => [g.id, g]))
    const map = new Map<string, { id: string; label: string; title: string }[]>()
    for (const a of assignmentsQ.data ?? []) {
      const g = groupById.get(a.group_id)
      if (!g) continue
      const cls = g.cohort?.name ?? ''
      const short = cls.replace(/^MMin\s+/i, '').split(/\s+/)[0] || cls
      const arr = map.get(a.volunteer_id) ?? []
      arr.push({
        id: a.id,
        label: short ? `${short} · ${g.name}` : g.name,
        title: cls ? `${translateClassName(cls)} · ${g.name}` : g.name,
      })
      map.set(a.volunteer_id, arr)
    }
    for (const arr of map.values())
      arr.sort((x, y) => x.label.localeCompare(y.label, undefined, { numeric: true }))
    return map
  }, [assignmentsQ.data, groupsQ.data])

  const firstGroupLabel = useMemo(() => {
    const map = new Map<string, string>()
    for (const [id, arr] of groupsByVolunteer) map.set(id, arr[0]?.label ?? '')
    return map
  }, [groupsByVolunteer])

  // 按班级筛选 → 搜索 → 按选定的列排序(点表头切换；默认角色置顶(super/admin)再按姓名 a→z)
  const rows = useMemo(() => {
    const all = data ?? []
    let list = all
    if (classFilter !== 'all') {
      const groupIdsInClass = new Set(
        (groupsQ.data ?? []).filter((g) => g.cohort_id === classFilter).map((g) => g.id),
      )
      const ids = new Set(
        (assignmentsQ.data ?? [])
          .filter((a) => groupIdsInClass.has(a.group_id))
          .map((a) => a.volunteer_id),
      )
      list = all.filter((v) => ids.has(v.volunteer_id))
    }
    const q = query.trim().toLowerCase()
    if (q)
      list = list.filter(
        (v) => v.full_name.toLowerCase().includes(q) || (v.email || '').toLowerCase().includes(q),
      )
    return [...list].sort((a, b) => compareVolunteers(a, b, sort, firstGroupLabel))
  }, [data, assignmentsQ.data, groupsQ.data, classFilter, query, sort, firstGroupLabel])

  async function onExport() {
    setExporting(true)
    try {
      const n = await exportVolunteers(rows, 'obs.xlsx')
      toast.success(`${n} OBS berhasil diekspor`)
    } catch (e) {
      toast.error(`Ekspor gagal: ${(e as Error).message}`)
    } finally {
      setExporting(false)
    }
  }

  function onDelete(id: string, name: string) {
    if (!window.confirm(`Hapus "${name}"? Ini menghapus akun dan penugasannya.`)) return
    del.mutate(id, {
      onSuccess: () => toast.success('Pengguna dihapus'),
      onError: (e) => toast.error(`Gagal: ${(e as Error).message}`),
    })
  }

  function onSetRole(id: string, name: string, role: 'admin' | 'volunteer') {
    const msg =
      role === 'admin'
        ? `Jadikan "${name}" admin? Mereka dapat akses admin penuh (tapi bukan kekuatan super admin).`
        : `Ubah "${name}" kembali jadi OBS?`
    if (!window.confirm(msg)) return
    setRole.mutate(
      { id, role },
      {
        onSuccess: () =>
          toast.success(role === 'admin' ? `${name} sekarang admin` : `${name} sekarang OBS`),
        onError: (e) => toast.error(`Gagal: ${(e as Error).message}`),
      },
    )
  }

  function onClearAssignments() {
    if (
      !window.confirm(
        'Kosongkan SEMUA penugasan OBS → grup?\n\nSetiap grup jadi kosong supaya kamu bisa impor ulang daftar bersih tanpa duplikat. Ini juga menghapus klaim pengganti yang sedang berjalan. Akun OBS, siswa, dan absensi TIDAK terpengaruh. Tindakan ini tidak bisa dibatalkan.',
      )
    )
      return
    clearAssignments.mutate(undefined, {
      onSuccess: (n) => toast.success(`${n} penugasan dikosongkan. Sekarang impor ulang daftarmu.`),
      onError: (e) => toast.error(`Gagal: ${(e as Error).message}`),
    })
  }

  if (isLoading) return <Spinner />

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input
          placeholder="Cari berdasarkan nama atau email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex items-center gap-2">
          {iAmSuper && (
            <Button
              variant="outline"
              onClick={onClearAssignments}
              disabled={clearAssignments.isPending}
              title="Hapus semua penugasan grup sebelum impor ulang daftar"
            >
              <Eraser className="size-4" />
              {clearAssignments.isPending ? 'Mengosongkan…' : 'Kosongkan penugasan grup'}
            </Button>
          )}
          {iAmSuper && (
            <Button
              variant={showImport ? 'secondary' : 'outline'}
              onClick={() => setShowImport((v) => !v)}
            >
              <Upload className="size-4" /> Impor CSV
            </Button>
          )}
          <Button variant="outline" onClick={() => void onExport()} disabled={exporting || rows.length === 0}>
            <Download className="size-4" /> {exporting ? 'Mengekspor…' : 'Ekspor Excel'}
          </Button>
        </div>
      </div>

      {iAmSuper && showImport && <ImportVolunteers />}

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">Tidak ada pengguna yang cocok.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead label="Nama" sortKey="name" sort={sort} onSort={(k) => setSort((s) => toggleSort(s, k))} />
                <SortableTableHead
                  label="Email"
                  sortKey="email"
                  sort={sort}
                  onSort={(k) => setSort((s) => toggleSort(s, k))}
                  className="whitespace-nowrap"
                />
                <SortableTableHead label="Peran" sortKey="role" sort={sort} onSort={(k) => setSort((s) => toggleSort(s, k))} />
                <SortableTableHead label="Grup ditugaskan" sortKey="group" sort={sort} onSort={(k) => setSort((s) => toggleSort(s, k))} />
                <SortableTableHead
                  label="Sesi dihadiri"
                  sortKey="sessions"
                  sort={sort}
                  onSort={(k) => setSort((s) => toggleSort(s, k))}
                  className="text-center"
                  align="center"
                />
                <SortableTableHead
                  label="Terakhir aktif"
                  sortKey="lastActive"
                  sort={sort}
                  onSort={(k) => setSort((s) => toggleSort(s, k))}
                  className="whitespace-nowrap"
                />
                <SortableTableHead
                  label="Pengganti diberikan"
                  sortKey="coverage"
                  sort={sort}
                  onSort={(k) => setSort((s) => toggleSort(s, k))}
                  className="text-center"
                  align="center"
                />
                <TableHead className="text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((v) => {
                const isSelf = v.volunteer_id === user?.id
                const canDelete = !isSelf && iAmSuper && v.role !== 'super_admin'
                const canToggleRole = !isSelf && iAmSuper && v.role !== 'super_admin'
                const vGroups = groupsByVolunteer.get(v.volunteer_id) ?? []
                return (
                  <TableRow key={v.volunteer_id}>
                    <TableCell className="font-medium">{v.full_name}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{v.email || '—'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          v.role === 'super_admin'
                            ? 'default'
                            : v.role === 'admin'
                              ? 'secondary'
                              : 'outline'
                        }
                      >
                        {roleLabel(v.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {vGroups.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex max-w-xs flex-wrap gap-1">
                          {vGroups.map((g) => (
                            <Badge key={g.id} variant="outline" className="font-normal" title={g.title}>
                              {g.label}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{v.sessions_recorded}</TableCell>
                    <TableCell className="whitespace-nowrap">{v.last_active ?? '—'}</TableCell>
                    <TableCell className="text-center tabular-nums">{v.coverage_count}</TableCell>
                    <TableCell className="text-center">
                      {isSelf ? (
                        <span className="text-muted-foreground text-xs">kamu</span>
                      ) : v.role === 'super_admin' ? (
                        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                          <Lock className="size-3" /> super
                        </span>
                      ) : !canToggleRole && !canDelete ? (
                        <span className="text-muted-foreground text-xs">—</span>
                      ) : (
                        <div className="flex items-center justify-center gap-3">
                          {canToggleRole &&
                            (v.role === 'volunteer' ? (
                              <button
                                type="button"
                                onClick={() => onSetRole(v.volunteer_id, v.full_name, 'admin')}
                                className="text-muted-foreground hover:text-foreground"
                                title="Jadikan admin"
                                aria-label={`Jadikan ${v.full_name} admin`}
                              >
                                <ShieldCheck className="size-3.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onSetRole(v.volunteer_id, v.full_name, 'volunteer')}
                                className="text-muted-foreground hover:text-foreground"
                                title="Jadikan OBS"
                                aria-label={`Jadikan ${v.full_name} OBS`}
                              >
                                <ShieldOff className="size-3.5" />
                              </button>
                            ))}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => onDelete(v.volunteer_id, v.full_name)}
                              className="text-muted-foreground hover:text-destructive"
                              title="Hapus"
                              aria-label={`Hapus ${v.full_name}`}
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-muted-foreground text-xs">
        Klik judul kolom untuk mengurutkan (klik lagi untuk membalik arah). Hanya <b>super admin</b> yang bisa
        impor, promosi/turunkan, atau hapus pengguna — admin mengelola penugasan, absensi &amp;
        laporan; OBS mencatat absensi. Kamu tidak bisa bertindak pada barismu sendiri atau super admin.
      </p>
    </div>
  )
}
