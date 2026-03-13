import { checkRecurringRules } from '../miniprogram/utils/recurring'
import {
  getRecurringRules,
  saveRecurringRules,
  getPendingDrafts,
  savePendingDrafts,
} from '../miniprogram/utils/storage'
import { IRecurringRule } from '../miniprogram/models/record'

// ── 工具函数 ──────────────────────────────────────────────────────────────────

function makeRule(overrides: Partial<IRecurringRule> = {}): IRecurringRule {
  return {
    id: 'rule_1',
    name: '测试规则',
    type: '支出',
    category: '餐饮',
    amount: 100000,
    note: '',
    frequency: 'monthly',
    dayOfMonth: 1,
    startDate: '2026-01-01',
    lastGeneratedDate: '2026-02-28',
    enabled: true,
    ...overrides,
  }
}

/** 固定 checkRecurringRules 内部的"今天" */
function runCheck(today: string) {
  jest.useFakeTimers().setSystemTime(new Date(today + 'T12:00:00'))
  checkRecurringRules()
  jest.useRealTimers()
}

beforeEach(() => {
  // 每个测试前清空 storage
  saveRecurringRules([])
  savePendingDrafts([])
})

// ── monthly ───────────────────────────────────────────────────────────────────

describe('monthly 规则', () => {
  test('到期日当天生成草稿', () => {
    saveRecurringRules([makeRule({ dayOfMonth: 1, lastGeneratedDate: '2026-02-28' })])
    runCheck('2026-03-01')
    const drafts = getPendingDrafts()
    expect(drafts).toHaveLength(1)
    expect(drafts[0].date).toBe('2026-03-01')
    expect(drafts[0].ruleName).toBe('测试规则')
  })

  test('未到期时不生成草稿', () => {
    saveRecurringRules([makeRule({ dayOfMonth: 15, lastGeneratedDate: '2026-02-28' })])
    runCheck('2026-03-01')
    expect(getPendingDrafts()).toHaveLength(0)
  })

  test('lastGeneratedDate 更新为今天', () => {
    saveRecurringRules([makeRule({ dayOfMonth: 1, lastGeneratedDate: '2026-02-28' })])
    runCheck('2026-03-01')
    expect(getRecurringRules()[0].lastGeneratedDate).toBe('2026-03-01')
  })

  test('同一日期不重复生成', () => {
    saveRecurringRules([makeRule({ dayOfMonth: 1, lastGeneratedDate: '2026-02-28' })])
    runCheck('2026-03-01')
    runCheck('2026-03-01')
    expect(getPendingDrafts()).toHaveLength(1)
  })

  test('跨月补生成（MAX_CATCHUP=3）', () => {
    // lastGeneratedDate = 12月31日，今天 = 4月1日，应补生成 2月1/3月1/4月1 共3次
    saveRecurringRules([makeRule({ dayOfMonth: 1, lastGeneratedDate: '2025-12-31' })])
    runCheck('2026-04-01')
    const drafts = getPendingDrafts()
    expect(drafts).toHaveLength(3)
    const dates = drafts.map(d => d.date).sort()
    expect(dates).toEqual(['2026-02-01', '2026-03-01', '2026-04-01'])
  })

  test('disabled 规则不生成草稿', () => {
    saveRecurringRules([makeRule({ dayOfMonth: 1, lastGeneratedDate: '2026-02-28', enabled: false })])
    runCheck('2026-03-01')
    expect(getPendingDrafts()).toHaveLength(0)
  })

  test('超过 endDate 不生成', () => {
    saveRecurringRules([makeRule({ dayOfMonth: 1, lastGeneratedDate: '2026-02-28', endDate: '2026-02-28' })])
    runCheck('2026-03-01')
    expect(getPendingDrafts()).toHaveLength(0)
  })

  test('未到 startDate 不生成', () => {
    saveRecurringRules([makeRule({ dayOfMonth: 1, startDate: '2026-04-01', lastGeneratedDate: '2026-02-28' })])
    runCheck('2026-03-01')
    expect(getPendingDrafts()).toHaveLength(0)
  })

  test('31日规则在2月生成最后一天', () => {
    saveRecurringRules([makeRule({ dayOfMonth: 31, lastGeneratedDate: '2026-01-31' })])
    runCheck('2026-02-28')
    const drafts = getPendingDrafts()
    expect(drafts).toHaveLength(1)
    expect(drafts[0].date).toBe('2026-02-28')
  })
})

// ── weekly ────────────────────────────────────────────────────────────────────

describe('weekly 规则', () => {
  test('每周一到期日生成草稿', () => {
    // 2026-03-09是周一，lastGeneratedDate = 03-08（周日）
    saveRecurringRules([makeRule({
      frequency: 'weekly',
      dayOfWeek: 1,
      dayOfMonth: undefined,
      lastGeneratedDate: '2026-03-08',
    })])
    runCheck('2026-03-09')
    const drafts = getPendingDrafts()
    expect(drafts).toHaveLength(1)
    expect(drafts[0].date).toBe('2026-03-09')
  })

  test('上次已生成周一后，周二检查不再生成', () => {
    // lastGeneratedDate = 2026-03-09（周一已生成），今天 = 03-10（周二），区间内无周一
    saveRecurringRules([makeRule({
      frequency: 'weekly',
      dayOfWeek: 1,
      dayOfMonth: undefined,
      lastGeneratedDate: '2026-03-09',
    })])
    runCheck('2026-03-10') // 周二
    expect(getPendingDrafts()).toHaveLength(0)
  })
})

// ── daily ─────────────────────────────────────────────────────────────────────

describe('daily 规则', () => {
  test('每天生成', () => {
    saveRecurringRules([makeRule({
      frequency: 'daily',
      dayOfMonth: undefined,
      lastGeneratedDate: '2026-03-09',
    })])
    runCheck('2026-03-12')
    const drafts = getPendingDrafts()
    expect(drafts).toHaveLength(3)
    expect(drafts.map(d => d.date).sort()).toEqual(['2026-03-10', '2026-03-11', '2026-03-12'])
  })
})

// ── yearly ────────────────────────────────────────────────────────────────────

describe('yearly 规则', () => {
  test('每年3月12日生成', () => {
    saveRecurringRules([makeRule({
      frequency: 'yearly',
      monthOfYear: 3,
      dayOfMonth: 12,
      lastGeneratedDate: '2026-03-11',
    })])
    runCheck('2026-03-12')
    const drafts = getPendingDrafts()
    expect(drafts).toHaveLength(1)
    expect(drafts[0].date).toBe('2026-03-12')
  })

  test('提前一天不生成', () => {
    saveRecurringRules([makeRule({
      frequency: 'yearly',
      monthOfYear: 3,
      dayOfMonth: 12,
      lastGeneratedDate: '2026-03-10',
    })])
    runCheck('2026-03-11')
    expect(getPendingDrafts()).toHaveLength(0)
  })
})

// ── 多规则 ─────────────────────────────────────────────────────────────────────

describe('多规则并存', () => {
  test('两条同时到期各生成一条草稿', () => {
    saveRecurringRules([
      makeRule({ id: 'rule_a', name: '房租', dayOfMonth: 1, lastGeneratedDate: '2026-02-28' }),
      makeRule({ id: 'rule_b', name: '话费', dayOfMonth: 1, lastGeneratedDate: '2026-02-28' }),
    ])
    runCheck('2026-03-01')
    const drafts = getPendingDrafts()
    expect(drafts).toHaveLength(2)
    expect(drafts.map(d => d.ruleName).sort()).toEqual(['房租', '话费'])
  })

  test('一条到期一条未到期', () => {
    saveRecurringRules([
      makeRule({ id: 'rule_a', name: '房租', dayOfMonth: 1, lastGeneratedDate: '2026-02-28' }),
      makeRule({ id: 'rule_b', name: '话费', dayOfMonth: 15, lastGeneratedDate: '2026-02-28' }),
    ])
    runCheck('2026-03-01')
    const drafts = getPendingDrafts()
    expect(drafts).toHaveLength(1)
    expect(drafts[0].ruleName).toBe('房租')
  })
})

// ── 草稿内容 ──────────────────────────────────────────────────────────────────

describe('草稿字段', () => {
  test('草稿继承规则的类型、类别、金额、备注', () => {
    saveRecurringRules([makeRule({
      type: '支出',
      category: '房租',
      amount: 300000,
      note: '月租',
      dayOfMonth: 1,
      lastGeneratedDate: '2026-02-28',
    })])
    runCheck('2026-03-01')
    const draft = getPendingDrafts()[0]
    expect(draft.type).toBe('支出')
    expect(draft.category).toBe('房租')
    expect(draft.amount).toBe(300000)
    expect(draft.note).toBe('月租')
    expect(draft.ruleId).toBe('rule_1')
  })
})
