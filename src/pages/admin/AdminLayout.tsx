import { Outlet } from 'react-router-dom'
import { useClasses } from '@/hooks/use-groups'
import { useClassFilter } from '@/hooks/use-class-filter'
import { translateClassName } from '@/lib/calendar'
import { PageHeader } from '@/components/page-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/** Admin 区域外壳：标题 + 跨页面共享的班级筛选(URL query),下方是各具体页面。 */
export function AdminLayout() {
  const [classFilter, setClassFilter] = useClassFilter()
  const classesQ = useClasses()
  const classes = classesQ.data ?? []

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Konsol Admin"
        actions={
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua kelas</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {translateClassName(c.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <Outlet />
    </div>
  )
}
