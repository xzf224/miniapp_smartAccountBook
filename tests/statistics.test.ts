import {
  calcMonthSummary,
  calcCategoryRanking,
  calcDailyComparison,
  calcMonthlyComparison,
} from '../miniprogram/utils/statistics'
import { IRecord } from '../miniprogram/models/record'

/** 测试用记录工厂函数 */
function makeRecord(overrides: Partial<IRecord> = {}): IRecord {
  return {
    id: Math.random().toString(36).slice(2),
    type: '支出',
    category: '餐饮',
    amount: 1000,
    date: '2026-03-01',
    note: '',
    createTime: Date.now(),
    updateTime: Date.now(),
    ...overrides,
  }
}

// ─── calcMonthSummary ─────────────────────────────────────────────────────────

describe('calcMonthSummary', () => {
  const records = [
    makeRecord({ type: '支出', amount: 3000, date: '2026-03-01' }),
    makeRecord({ type: '支出', amount: 1500, date: '2026-03-15' }),
    makeRecord({ type: '收入', amount: 10000, date: '2026-03-05' }),
    makeRecord({ type: '不计入收支', amount: 5000, date: '2026-03-10' }),
    makeRecord({ type: '支出', amount: 2000, date: '2026-02-28' }), // 上月，不计入
  ]

  test('当月支出合计', () => {
    expect(calcMonthSummary(records, 2026, 3).expense).toBe(4500)
  })

  test('当月收入合计', () => {
    expect(calcMonthSummary(records, 2026, 3).income).toBe(10000)
  })

  test('结余 = 收入 - 支出', () => {
    expect(calcMonthSummary(records, 2026, 3).balance).toBe(5500)
  })

  test('"不计入收支"不影响汇总', () => {
    const s = calcMonthSummary(records, 2026, 3)
    expect(s.expense).toBe(4500)
    expect(s.income).toBe(10000)
  })

  test('上月记录不计入当月', () => {
    // 2月数据
    const s = calcMonthSummary(records, 2026, 2)
    expect(s.expense).toBe(2000)
    expect(s.income).toBe(0)
  })

  test('空数据集返回全零', () => {
    expect(calcMonthSummary([], 2026, 3)).toEqual({ income: 0, expense: 0, balance: 0 })
  })

  test('无该月数据返回全零', () => {
    expect(calcMonthSummary(records, 2025, 1)).toEqual({ income: 0, expense: 0, balance: 0 })
  })
})

// ─── calcCategoryRanking ──────────────────────────────────────────────────────

describe('calcCategoryRanking', () => {
  const records = [
    makeRecord({ type: '支出', category: '餐饮', amount: 5000, date: '2026-03-01' }),
    makeRecord({ type: '支出', category: '餐饮', amount: 3000, date: '2026-03-05' }),
    makeRecord({ type: '支出', category: '交通', amount: 2000, date: '2026-03-10' }),
    makeRecord({ type: '收入', category: '工资', amount: 100000, date: '2026-03-25' }),
  ]

  test('按金额降序排列', () => {
    const ranking = calcCategoryRanking(records, 2026, 3, '支出')
    expect(ranking[0].category).toBe('餐饮')
    expect(ranking[1].category).toBe('交通')
  })

  test('同类别金额合并', () => {
    const ranking = calcCategoryRanking(records, 2026, 3, '支出')
    expect(ranking[0].amount).toBe(8000)
  })

  test('百分比之和为100', () => {
    const ranking = calcCategoryRanking(records, 2026, 3, '支出')
    const total = ranking.reduce((s, r) => s + r.percentage, 0)
    expect(total).toBe(100)
  })

  test('不同 type 各自独立', () => {
    const ranking = calcCategoryRanking(records, 2026, 3, '收入')
    expect(ranking).toHaveLength(1)
    expect(ranking[0].category).toBe('工资')
    expect(ranking[0].amount).toBe(100000)
  })

  test('该月无数据返回空数组', () => {
    expect(calcCategoryRanking(records, 2026, 2, '支出')).toHaveLength(0)
  })

  test('amountText 格式为两位小数字符串', () => {
    const ranking = calcCategoryRanking(records, 2026, 3, '支出')
    expect(ranking[0].amountText).toBe('80.00')
  })

  test('每项 color 非空', () => {
    const ranking = calcCategoryRanking(records, 2026, 3, '支出')
    ranking.forEach(r => expect(r.color).toMatch(/^#[0-9A-Fa-f]{6}$/))
  })
})

// ─── calcDailyComparison ──────────────────────────────────────────────────────

describe('calcDailyComparison', () => {
  const records = [
    makeRecord({ type: '支出', amount: 3000, date: '2026-03-01' }),
    makeRecord({ type: '支出', amount: 1500, date: '2026-03-01' }),
    makeRecord({ type: '支出', amount: 2000, date: '2026-03-15' }),
    makeRecord({ type: '收入', amount: 5000, date: '2026-03-01' }), // 收入不计入支出对比
  ]

  test('返回当月天数条数据（3月 = 31天）', () => {
    const data = calcDailyComparison(records, 2026, 3, '支出')
    expect(data).toHaveLength(31)
  })

  test('同日金额正确累加', () => {
    const data = calcDailyComparison(records, 2026, 3, '支出')
    expect(data[0].value).toBe(4500) // 3月1日：3000 + 1500
  })

  test('无记录的日期为 0', () => {
    const data = calcDailyComparison(records, 2026, 3, '支出')
    expect(data[1].value).toBe(0) // 3月2日无支出
  })

  test('label 为日期数字字符串', () => {
    const data = calcDailyComparison(records, 2026, 3, '支出')
    expect(data[0].label).toBe('1')
    expect(data[14].label).toBe('15')
  })

  test('type 过滤：收入不计入支出统计', () => {
    const data = calcDailyComparison(records, 2026, 3, '支出')
    expect(data[0].value).toBe(4500) // 不含收入5000
  })
})

// ─── calcMonthlyComparison ────────────────────────────────────────────────────

describe('calcMonthlyComparison', () => {
  const records = [
    makeRecord({ type: '支出', amount: 5000, date: '2026-01-10' }),
    makeRecord({ type: '支出', amount: 8000, date: '2026-02-15' }),
    makeRecord({ type: '支出', amount: 3000, date: '2026-03-01' }),
  ]

  test('返回6条数据（近6个月）', () => {
    const data = calcMonthlyComparison(records, '支出')
    expect(data).toHaveLength(6)
  })

  test('每项包含 label 和 value', () => {
    const data = calcMonthlyComparison(records, '支出')
    data.forEach(d => {
      expect(d).toHaveProperty('label')
      expect(d).toHaveProperty('value')
      expect(typeof d.value).toBe('number')
    })
  })

  test('无记录月份 value 为 0', () => {
    const data = calcMonthlyComparison([], '支出')
    data.forEach(d => expect(d.value).toBe(0))
  })
})
