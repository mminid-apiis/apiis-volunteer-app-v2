import { Link } from 'react-router-dom'
import { useAllGroups } from '@/hooks/use-groups'
import { useClassFilter } from '@/hooks/use-class-filter'
import { Spinner } from '@/components/spinner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function AdminRecordsPage() {
  const [classFilter] = useClassFilter()
  const groupsQ = useAllGroups()
  if (groupsQ.isLoading) return <Spinner />
  const groups = (groupsQ.data ?? []).filter(
    (g) => classFilter === 'all' || g.cohort_id === classFilter,
  )

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((g) => (
        <Card key={g.id}>
          <CardHeader>
            <CardTitle className="text-base">{g.name}</CardTitle>
            {g.cohort?.name && <p className="text-muted-foreground text-xs">{g.cohort.name}</p>}
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="secondary">
              <Link to={`/groups/${g.id}`}>Buka absensi</Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
