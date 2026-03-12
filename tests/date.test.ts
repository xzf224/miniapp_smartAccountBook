import {
  getToday,
  getDaysInMonth,
  getMonthRange,
  groupRecordsByDate,
  getPreviousMonths,
} from '../miniprogram/utils/date'
import { IRecord } from '../miniprogram/models/record'

function makeRecord(overrides: Partial<IRecord> = {}): IRecord {
  return {
    id: '1', type: '支出', category: '餐饮',
    amount: 1000, date: '2026-03-01', note: '',
    createTime: 1, updateTime: 1, ...overrides,
  }
}

describe('getToday', () => {
  test('格式为 YYYY-MM-DD', () => {
    expect(getToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  test('月份和日期均有零填充', () => {
    const parts = getToday().split('-')
    expect(parts[1].length).toBe(2)
    expect(parts[2].length).toBe(2)
  })
})

describe('getDaysInMonth', () => {
  test('1月 31 天', () => expect(getDaysInMonth(2026, 1)).toBe(31))
  test('3月 31 天', () => expect(getDaysInMonth(2026, 3)).toBe(31))
  test('4月 30 天', () => expect(getDaysInMonth(2026, 4)).toBe(30))
  test('6月 30 天', () => expect(getDaysInMonth(2026, 6)).toBe(30))
  test('2月平年 28 天', () => expect(getDaysInMonth(2025, 2)).toBe(28))
  test('2月闰年 29 天', () => expect(getDaysInMonth(2024, 2)).toBe(29))
  test('12月 31 天', () => expect(getDaysInMonth(2026, 12)).toBe(31))
})

describe('getMonthRange', () => {
  test('3月正确起止日期', () => {
    expect(getMonthRange(2026, 3)).toEqual(['2026-03-01', '2026-03-31'])
  })

  test('2月平年', () => {
    expect(getMonthRange(2025, 2)).toEqual(['2025-02-01', '2025-02-28'])
  })

  test('2月闰年', () => {
    expect(getMonthRange(2024, 2)).toEqual(['2024-02-01', '2024-02-29'])
  })

  test('12月', () => {
    expect(getMonthRange(2026, 12)).toEqual(['2026-12-01', '2026-12-31'])
  })

  test('月份两位零填充', () => {
    const [start] = getMonthRange(2026, 1)
    expect(start).toBe('2026-01-01')
  })
})

describe('getPreviousMonths', () => {
  test('返回指定数量', () => {
    expect(getPreviousMonths(6)).toHaveLength(6)
  })

  test('每项为 [year, month] 元组', () => {
    const months = getPreviousMonths(3)
    months.forEach(([y, m]) => {
      expect(typeof y).toBe('number')
      expect(m).toBeGreaterThanOrEqual(1)
      expect(m).toBeLessThanOrEqual(12)
    })
  })

  test('按时间升序排列（最旧在前）', () => {
    const months = getPreviousMonths(3)
    const [y0, m0] = months[0]
    const [y1, m1] = months[1]
    const t0 = y0 * 12 + m0
    const t1 = y1 * 12 + m1
    expect(t0).toBeLessThanOrEqual(t1)
  })
})

describe('groupRecordsByDate', () => {
  const records = [
    makeRecord({ id: '1', date: '2026-03-10', type: '支出', amount: 1000 }),
    makeRecord({ id: '2', date: '2026-03-10', type: '支出', amount: 2000 }),
    makeRecord({ id: '3', date: '2026-03-09', type: '支出', amount: 500 }),
    makeRecord({ id: '4', date: '2026-03-10', type: '收入', amount: 3000 }),
  ]

  test('按日期分成两组', () => {
    expect(groupRecordsByDate(records)).toHaveLength(2)
  })

  test('同日期记录归为一组', () => {
    const groups = groupRecordsByDate(records)
    const g10 = groups.find(g => g.date === '2026-03-10')
    expect(g10?.records).toHaveLength(3)
  })

  test('dayExpense 正确累加', () => {
    const groups = groupRecordsByDate(records)
    const g10 = groups.find(g => g.date === '2026-03-10')
    expect(g10?.dayExpense).toBe(3000) // 1000 + 2000，收入不计
  })

  test('dayIncome 正确累加', () => {
    const groups = groupRecordsByDate(records)
    const g10 = groups.find(g => g.date === '2026-03-10')
    expect(g10?.dayIncome).toBe(3000)
  })

  test('空数组返回空数组', () => {
    expect(groupRecordsByDate([])).toHaveLength(0)
  })

  test('dateDisplay 字段存在且非空', () => {
    const groups = groupRecordsByDate(records)
    groups.forEach(g => expect(g.dateDisplay).toBeTruthy())
  })
})
