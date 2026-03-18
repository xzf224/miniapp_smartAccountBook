import { IRecord, RecordType, fenToYuan } from '../models/record'
import { getDaysInMonth, getPreviousMonths } from './date'

export interface MonthSummary {
  income: number    // 分
  expense: number   // 分
  balance: number   // 分
}

export interface CategoryRankItem {
  category: string
  amount: number       // 分
  amountText: string   // 元（已格式化）
  percentage: number   // 0-100，整数
  color: string
}

export interface ComparisonDatum {
  label: string
  value: number
}

export const CHART_COLORS = [
  '#5B8FF9', '#5AD8A6', '#5D7092', '#F6BD16', '#E86452',
  '#6DC8EC', '#945FB9', '#FF9845', '#1E9493', '#FF99C3',
  '#61DDAA', '#7262FD',
]

function filterMonthRecords(records: IRecord[], year: number, month: number): IRecord[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  return records.filter(r => r.date.startsWith(prefix))
}

/** 计算月度收支汇总 */
export function calcMonthSummary(records: IRecord[], year: number, month: number, currency?: string): MonthSummary {
  const monthRecords = filterMonthRecords(records, year, month)
  let income = 0
  let expense = 0
  for (const r of monthRecords) {
    if (currency && (r.currency ?? 'CNY') !== currency) continue
    if (r.type === '收入') income += r.amount
    else if (r.type === '支出') expense += r.amount
  }
  return { income, expense, balance: income - expense }
}

/** 计算某类型的类别排行（按金额降序） */
export function calcCategoryRanking(
  records: IRecord[],
  year: number,
  month: number,
  type: RecordType,
  currency?: string,
): CategoryRankItem[] {
  const monthRecords = filterMonthRecords(records, year, month)
    .filter(r => r.type === type)
    .filter(r => !currency || (r.currency ?? 'CNY') === currency)
  const totals = new Map<string, number>()
  let totalAll = 0
  for (const r of monthRecords) {
    totals.set(r.category, (totals.get(r.category) || 0) + r.amount)
    totalAll += r.amount
  }
  if (totalAll === 0) return []

  const sorted = Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])

  return sorted.map(([category, amount], idx) => ({
    category,
    amount,
    amountText: fenToYuan(amount),
    percentage: Math.round((amount / totalAll) * 100),
    color: CHART_COLORS[idx % CHART_COLORS.length],
  }))
}

/** 每日对比数据（当月每天的金额） */
export function calcDailyComparison(
  records: IRecord[],
  year: number,
  month: number,
  type: RecordType,
  currency?: string,
): ComparisonDatum[] {
  const monthRecords = filterMonthRecords(records, year, month)
    .filter(r => r.type === type)
    .filter(r => !currency || (r.currency ?? 'CNY') === currency)
  const days = getDaysInMonth(year, month)
  const result: ComparisonDatum[] = []
  for (let d = 1; d <= days; d++) {
    const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const total = monthRecords
      .filter(r => r.date === dayStr)
      .reduce((sum, r) => sum + r.amount, 0)
    result.push({ label: String(d), value: total })
  }
  return result
}

/** 每周对比数据（近 8 周，含当前周） */
export function calcWeeklyComparison(
  records: IRecord[],
  type: RecordType,
  currency?: string,
): ComparisonDatum[] {
  const result: ComparisonDatum[] = []
  const now = new Date()
  // 找本周周一
  const day = now.getDay() || 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + 1)
  monday.setHours(0, 0, 0, 0)

  for (let i = 7; i >= 0; i--) {
    const wStart = new Date(monday)
    wStart.setDate(monday.getDate() - i * 7)
    const wEnd = new Date(wStart)
    wEnd.setDate(wStart.getDate() + 6)

    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const startStr = fmt(wStart)
    const endStr = fmt(wEnd)

    const total = records
      .filter(r => r.type === type && r.date >= startStr && r.date <= endStr)
      .filter(r => !currency || (r.currency ?? 'CNY') === currency)
      .reduce((sum, r) => sum + r.amount, 0)

    const label = `${wStart.getMonth() + 1}/${wStart.getDate()}`
    result.push({ label, value: total })
  }
  return result
}

/** 每月对比数据（近 6 个月） */
export function calcMonthlyComparison(
  records: IRecord[],
  type: RecordType,
  currency?: string,
): ComparisonDatum[] {
  const months = getPreviousMonths(6)
  return months.map(([y, m]) => {
    const prefix = `${y}-${String(m).padStart(2, '0')}`
    const total = records
      .filter(r => r.type === type && r.date.startsWith(prefix))
      .filter(r => !currency || (r.currency ?? 'CNY') === currency)
      .reduce((sum, r) => sum + r.amount, 0)
    return { label: `${m}月`, value: total }
  })
}

/** 选定月份内，按周一到周日聚合 */
export function calcWeekdayComparison(
  records: IRecord[],
  year: number,
  month: number,
  type: RecordType,
  currency?: string,
): ComparisonDatum[] {
  const labels = ['一', '二', '三', '四', '五', '六', '日']
  const totals = new Array<number>(7).fill(0)
  const monthRecords = filterMonthRecords(records, year, month)
    .filter(r => r.type === type)
    .filter(r => !currency || (r.currency ?? 'CNY') === currency)

  for (const record of monthRecords) {
    const weekday = new Date(`${record.date}T00:00:00`).getDay()
    const index = weekday === 0 ? 6 : weekday - 1
    totals[index] += record.amount
  }

  return labels.map((label, index) => ({ label, value: totals[index] }))
}

/** 选定年份内，按月份聚合 */
export function calcYearlyComparison(
  records: IRecord[],
  year: number,
  type: RecordType,
  currency?: string,
): ComparisonDatum[] {
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    const prefix = `${year}-${String(month).padStart(2, '0')}`
    const total = records
      .filter(r => r.type === type && r.date.startsWith(prefix))
      .filter(r => !currency || (r.currency ?? 'CNY') === currency)
      .reduce((sum, r) => sum + r.amount, 0)
    return { label: `${month}月`, value: total }
  })
}
