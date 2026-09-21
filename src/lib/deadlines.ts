// 可用性 / 补位的截止时间。全部按组织时区 UTC+8 的“墙上时间”定义，
// 计算成 UTC 毫秒瞬间，便于与 Date.now() 比较（与浏览器所在时区无关）。

import { weekdayOffsetForClass } from './calendar'

const TZ = 8 // UTC+8

/** 以「该周周一(ISO)+ 天数偏移」的那一天、UTC+8 的 hour:minute，返回 UTC 毫秒瞬间。 */
function instant(weekMondayISO: string, dayOffset: number, hour: number, minute: number): number {
  const [y, m, d] = weekMondayISO.split('-').map(Number)
  const day = new Date(Date.UTC(y, m - 1, d + dayOffset)) // 规整加减天数(跨月/跨年安全)
  return Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour - TZ, minute)
}

/** 可用性回复截止：该周周六 22:59（UTC+8）。 */
export function availabilityDeadline(weekMondayISO: string): number {
  return instant(weekMondayISO, -2, 22, 59)
}

/**
 * 补位认领截止（通用规则，UTC+8）：以该班上课当天为锚点（星期偏移复用
 * weekdayOffsetForClass，与日历模块保持一致）——
 *   班名含 "evening" → 当天中午 12:00 ·  班名含 "morning" → 前一天 22:00 · 都不含 → 默认前一天 22:00。
 */
export function coverageDeadline(weekMondayISO: string, className: string): number | null {
  const dayOffset = weekdayOffsetForClass(className)
  const lower = className.toLowerCase()
  if (lower.includes('evening')) return instant(weekMondayISO, dayOffset, 12, 0)
  return instant(weekMondayISO, dayOffset - 1, 22, 0) // "morning" 及无法识别时的默认值
}

export function isPast(deadlineMs: number): boolean {
  return Date.now() > deadlineMs
}

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const pad = (n: number) => String(n).padStart(2, '0')

/** 把截止瞬间格式化成 UTC+8 墙上时间标签，如 "Sab 06-27 19:59"。 */
export function formatDeadline(deadlineMs: number): string {
  const d = new Date(deadlineMs + TZ * 3600 * 1000) // 偏到 UTC+8 后用 UTC 取值
  return `${DAYS[d.getUTCDay()]} ${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}
