import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useAddGroup, useAllGroups, useClasses } from '@/hooks/use-groups'
import { useAssignments, useAllUsers, useGroupCheckMarks } from '@/hooks/use-assignments'
import { useClassFilter } from '@/hooks/use-class-filter'
import { GroupAssignmentCard } from '@/components/group-assignment-card'
import { Spinner } from '@/components/spinner'

// 组短码,如 "MMin 2 Leadership - Monday Evening" + Group 7 → "2L-G7"
function groupCode(g: { name: string; cohort: { name: string } | null }): string {
  const cls = g.cohort?.name ?? ''
  const m = cls.match(/MMin\s+(\d+)\s+(\w)/i) // 课程号 + 赛道首字母(Leadership→L / Pastoral→P)
  const sec = m ? `${m[1]}${m[2].toUpperCase()}` : cls
  const num = g.name.replace(/^group\s*/i, '')
  return `${sec}-G${num}`
}

export function AdminGroupsPage() {
  const [classFilter] = useClassFilter()
  const classesQ = useClasses()
  const groupsQ = useAllGroups()
  const usersQ = useAllUsers()
  const assignmentsQ = useAssignments()
  const marksQ = useGroupCheckMarks()
  const addGroup = useAddGroup()

  if (classesQ.isLoading || groupsQ.isLoading || usersQ.isLoading || assignmentsQ.isLoading) {
    return <Spinner label="Memuat grup & penugasan…" />
  }
  const users = usersQ.data ?? []
  const assignments = assignmentsQ.data ?? []
  const marksByGroup = new Map((marksQ.data ?? []).map((m) => [m.group_id, m.status]))

  // 每个志愿者的「原属」组(import 来源、非补位),用于在补位/管理员指派的徽章后标注,如 "(2L-G7)"
  const allGroups = groupsQ.data ?? []
  const groupById = new Map(allGroups.map((g) => [g.id, g]))
  const originalByVolunteer = new Map<string, string>()
  for (const a of assignments) {
    if (a.source !== 'import' || a.coverage_week != null) continue
    const g = groupById.get(a.group_id)
    if (!g) continue
    const code = groupCode(g)
    originalByVolunteer.set(
      a.volunteer_id,
      originalByVolunteer.has(a.volunteer_id)
        ? `${originalByVolunteer.get(a.volunteer_id)}, ${code}`
        : code,
    )
  }

  const classes = (classesQ.data ?? []).filter((c) => classFilter === 'all' || c.id === classFilter)

  function onAddGroup(cohortId: string, className: string, existingNames: string[]) {
    const meetingDay = className.toLowerCase().includes('tuesday') ? 'Tuesday' : 'Monday'
    addGroup.mutate(
      { cohortId, existingNames, meetingDay },
      {
        onSuccess: () => toast.success('Grup baru ditambahkan'),
        onError: (e) => toast.error(`Gagal: ${(e as Error).message}`),
      },
    )
  }

  if (classes.length === 0) {
    return <p className="text-muted-foreground text-sm">Tidak ada kelas.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="bg-secondary inline-block size-3 rounded-full" /> Daftar awal
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-full bg-blue-700" /> Ditugaskan admin
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-full border bg-green-100" /> Pengganti
        </span>
      </div>
      <p className="text-muted-foreground text-xs">
        "Hadir / Tidak Hadir" adalah catatan sementara untuk melacak apakah OBS asli hadir — tidak
        disimpan ke absensi dan otomatis dikosongkan setiap hari Rabu.
      </p>

      {classes.map((c) => {
        const groups = allGroups.filter((g) => g.cohort_id === c.id)
        return (
          <div key={c.id} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">{c.name}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {groups.map((g) => (
                <GroupAssignmentCard
                  key={g.id}
                  group={g}
                  users={users}
                  assignments={assignments}
                  checkStatus={marksByGroup.get(g.id) ?? null}
                  originals={originalByVolunteer}
                />
              ))}
              <button
                type="button"
                onClick={() =>
                  onAddGroup(
                    c.id,
                    c.name,
                    groups.map((g) => g.name),
                  )
                }
                disabled={addGroup.isPending}
                className="border-muted-foreground/30 text-muted-foreground hover:border-brand hover:text-brand flex min-h-24 items-center justify-center gap-1.5 rounded-lg border border-dashed text-sm font-medium transition-colors"
              >
                <Plus className="size-4" /> Tambah Grup
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
