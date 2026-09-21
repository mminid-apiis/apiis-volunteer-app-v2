import { useAllGroups } from '@/hooks/use-groups'
import { useAssignments, useAllUsers, useGroupCheckMarks } from '@/hooks/use-assignments'
import { useClassFilter } from '@/hooks/use-class-filter'
import { GroupAssignmentCard } from '@/components/group-assignment-card'
import { Spinner } from '@/components/spinner'

// 组短码,如 MMin 7L Monday Night + Group 7 → "7L-G7"
function groupCode(g: { name: string; cohort: { name: string } | null }): string {
  const cls = g.cohort?.name ?? ''
  const sec = cls.replace(/^MMin\s+/i, '').split(/\s+/)[0] || cls
  const num = g.name.replace(/^group\s*/i, '')
  return `${sec}-G${num}`
}

export function AdminGroupsPage() {
  const [classFilter] = useClassFilter()
  const groupsQ = useAllGroups()
  const usersQ = useAllUsers()
  const assignmentsQ = useAssignments()
  const marksQ = useGroupCheckMarks()

  if (groupsQ.isLoading || usersQ.isLoading || assignmentsQ.isLoading) {
    return <Spinner label="Loading groups & assignments…" />
  }
  const users = usersQ.data ?? []
  const assignments = assignmentsQ.data ?? []
  const marksByGroup = new Map((marksQ.data ?? []).map((m) => [m.group_id, m.status]))

  // 每个志愿者的「原属」组(import 来源、非补位),用于在补位/管理员指派的徽章后标注,如 "(7L-G7)"
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

  const groups = allGroups.filter((g) => classFilter === 'all' || g.cohort_id === classFilter)

  if (groups.length === 0) {
    return <p className="text-muted-foreground text-sm">No groups.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="bg-secondary inline-block size-3 rounded-full" /> Roster (original)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-full bg-blue-700" /> Admin-assigned
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-full border bg-green-100" /> Coverage
        </span>
      </div>
      <p className="text-muted-foreground text-xs">
        “Present / Absent” is a temporary note for tracking whether the original OBS showed up — it
        isn’t saved to attendance and is cleared every Wednesday.
      </p>
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
      </div>
    </div>
  )
}
