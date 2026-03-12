import { IRecord, fenToYuan } from '../models/record'

/** 获取今天日期字符串 YYYY-MM-DD */
export function getToday(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/** 格式化日期为 MM月DD日 周X */
export function formatDateDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const today = getToday()
  const yesterday = (() => {
    const t = new Date()
    t.setDate(t.getDate() - 1)
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  })()
  if (dateStr === today) return `今天  ${m}月${d}日`
  if (dateStr === yesterday) return `昨天  ${m}月${d}日`
  return `${m}月${d}日  周${WEEKDAYS[date.getDay()]}`
}

/** 获取指定月份的起止日期 */
export function getMonthRange(year: number, month: number): [string, string] {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = getDaysInMonth(year, month)
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return [start, end]
}

/** 获取指定月份的天数 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/** 将记录按日期分组 */
export function groupRecordsByDate(records: IRecord[]): Array<{
  date: string
  dateDisplay: string
  records: IRecord[]
  dayIncome: number
  dayExpense: number
  dayIncomeText: string
  dayExpenseText: string
}> {
  const map = new Map<string, IRecord[]>()
  for (const r of records) {
    const arr = map.get(r.date) || []
    arr.push(r)
    map.set(r.date, arr)
  }
  // 按日期降序排列
  const dates = Array.from(map.keys()).sort((a, b) => b.localeCompare(a))
  return dates.map(date => {
    const dayRecords = map.get(date)!
    let dayIncome = 0
    let dayExpense = 0
    for (const r of dayRecords) {
      if (r.type === '收入') dayIncome += r.amount
      else if (r.type === '支出') dayExpense += r.amount
    }
    const dayNet = dayIncome - dayExpense
    return {
      date,
      dateDisplay: formatDateDisplay(date),
      records: dayRecords,
      dayIncome,
      dayExpense,
      dayIncomeText: fenToYuan(dayIncome),
      dayExpenseText: fenToYuan(dayExpense),
      dayNet,
      dayNetText: fenToYuan(Math.abs(dayNet)),
      dayNetNegative: dayNet < 0,
    }
  })
}

/** 获取前 N 个月的 [year, month] 列表（包含当前月，从旧到新） */
export function getPreviousMonths(count: number): Array<[number, number]> {
  const result: Array<[number, number]> = []
  const now = new Date()
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push([d.getFullYear(), d.getMonth() + 1])
  }
  return result
}

/** 获取指定日期所在周的起止日期（周一到周日） */
export function getWeekRange(dateStr: string): [string, string] {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const day = date.getDay() || 7  // 0(周日) -> 7
  const monday = new Date(date)
  monday.setDate(date.getDate() - day + 1)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  return [fmt(monday), fmt(sunday)]
}
