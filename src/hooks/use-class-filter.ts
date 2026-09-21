import { useSearchParams } from 'react-router-dom'

/** Admin 各页面共享的 class 筛选,存在 URL query(?class=)里,页面间导航不丢失。 */
export function useClassFilter(): [string, (value: string) => void] {
  const [params, setParams] = useSearchParams()
  const classFilter = params.get('class') ?? 'all'

  function setClassFilter(value: string) {
    const next = new URLSearchParams(params)
    if (value === 'all') next.delete('class')
    else next.set('class', value)
    setParams(next, { replace: true })
  }

  return [classFilter, setClassFilter]
}
