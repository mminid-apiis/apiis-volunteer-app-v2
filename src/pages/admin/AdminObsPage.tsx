import { useClassFilter } from '@/hooks/use-class-filter'
import { VolunteersReport } from '@/components/volunteers-report'

export function AdminObsPage() {
  const [classFilter] = useClassFilter()
  return <VolunteersReport classFilter={classFilter} />
}
