/** 解析 CSV 文本为二维数组（支持双引号字段与 "" 转义）。 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue
    const fields: string[] = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"'
            i++
          } else inQuotes = false
        } else cur += ch
      } else if (ch === '"') inQuotes = true
      else if (ch === ',') {
        fields.push(cur)
        cur = ''
      } else cur += ch
    }
    fields.push(cur)
    rows.push(fields.map((f) => f.trim()))
  }
  return rows
}

// 表头识别正则（English + 中文 + Bahasa Indonesia 同义词），dropHeader / mapCsvColumns 共用。
const HEADER_PATTERN = /\b(name|email|class|group|phone|nama|kelas|grup|kelompok|telepon)\b|姓名|班级|组|邮箱|电话/

/** 若首行看起来像表头则去掉。 */
export function dropHeader(rows: string[][]): string[][] {
  if (rows.length === 0) return rows
  const first = rows[0].join(',').toLowerCase()
  if (HEADER_PATTERN.test(first)) {
    return rows.slice(1)
  }
  return rows
}

const COLUMN_SYNONYMS: Record<string, string[]> = {
  name: ['name', 'full name', 'fullname', 'nama', 'nama lengkap', '姓名', '名字'],
  email: ['email', 'e-mail', 'email address', '邮箱', '电邮'],
  phone: ['phone', 'phone number', 'mobile', 'tel', 'telepon', 'no telepon', 'no hp', 'hp', '电话', '手机'],
  class: ['class', 'cohort', 'kelas', '班级', '班'],
  group: ['group', 'grup', 'kelompok', '组', '小组'],
}

/**
 * 列映射：若首行是表头，按字段名(含同义词、大小写/BOM 容错)定位各列，
 * 与列顺序/是否含某列无关；否则用调用方给的默认列位作兜底（无表头时）。
 * 返回数据行 body 与按字段取值的 get(row, field)。表头里没有的字段返回空串。
 */
export function mapCsvColumns(
  rows: string[][],
  defaults: Record<string, number>,
): { body: string[][]; get: (row: string[], field: string) => string } {
  const headerLine = rows.length ? rows[0].join(',').toLowerCase() : ''
  const hasHeader = HEADER_PATTERN.test(headerLine)
  const idx: Record<string, number> = {}
  let body = rows
  if (hasHeader) {
    body = rows.slice(1)
    const header = rows[0].map((h) => h.trim().toLowerCase())
    for (const field of Object.keys(defaults)) {
      const syns = COLUMN_SYNONYMS[field] ?? [field]
      idx[field] = header.findIndex((h) => syns.includes(h)) // -1 = 表头无此列
    }
  } else {
    for (const field of Object.keys(defaults)) idx[field] = defaults[field]
  }
  const get = (row: string[], field: string) => {
    const i = idx[field]
    return i !== undefined && i >= 0 ? (row[i] ?? '') : ''
  }
  return { body, get }
}
