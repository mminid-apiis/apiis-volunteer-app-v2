import { useClassFilter } from '@/hooks/use-class-filter'
import { StudentsReport } from '@/components/students-report'

export function AdminStudentsPage() {
  const [classFilter] = useClassFilter()
  return <StudentsReport classFilter={classFilter} />
}
