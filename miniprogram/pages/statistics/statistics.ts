import { getRecords, getBudgetAmount } from '../../utils/storage'
import {
  calcMonthSummary,
  calcCategoryRanking,
  calcDailyComparison,
  calcWeekdayComparison,
  calcYearlyComparison,
  ComparisonDatum,
  CategoryRankItem,
} from '../../utils/statistics'
import { fenToYuan, RecordType, RECORD_TYPES } from '../../models/record'

type CompareMode = 'daily' | 'weekly' | 'monthly'

const now = new Date()
const PICKER_YEARS: string[] = Array.from({ length: 11 }, (_, i) => `${2020 + i}年`)
const PICKER_MONTHS: string[] = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

function getStatusBarHeight(): number {
  const wxApi = wx as any
  const info = typeof wxApi.getWindowInfo === 'function'
    ? wxApi.getWindowInfo()
    : wx.getSystemInfoSync()
  return info.statusBarHeight || info.safeArea?.top || 0
}

function formatAmount(fen: number, withCurrency = false): string {
  const normalized = fenToYuan(fen)
  const trimmed = normalized.includes('.')
    ? normalized.replace(/\.00$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
    : normalized
  const [integerPart, decimalPart] = trimmed.split('.')
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const amount = decimalPart ? `${groupedInteger}.${decimalPart}` : groupedInteger
  return withCurrency ? `¥ ${amount}` : amount
}

function getTrendColor(type: RecordType): string {
  if (type === '收入') return '#2ECC71'
  if (type === '不计入收支') return '#5B8FF9'
  return '#FF8A00'
}

Component({
  data: {
    statusBarHeight: 0,
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    pickerRange: [PICKER_YEARS, PICKER_MONTHS] as string[][],
    pickerValue: [now.getFullYear() - 2020, now.getMonth()] as number[],
    typeIndex: 0,
    types: ['支出', '收入', '不计入收支'],
    income: '¥ 0',
    expense: '¥ 0',
    typeTotalText: '0',
    pieData: [] as Array<{ name: string; value: number; color: string }>,
    rankingList: [] as any[],
    compareMode: 'weekly' as CompareMode,
    compareTabs: [
      { mode: 'weekly', label: '周' },
      { mode: 'daily', label: '月' },
      { mode: 'monthly', label: '年' },
    ] as Array<{ mode: CompareMode; label: string }>,
    barData: [] as ComparisonDatum[],
    barColor: getTrendColor('支出'),
    hasPieData: false,
    hasBarData: false,
  },

  lifetimes: {
    attached() {
      this.setData({ statusBarHeight: getStatusBarHeight() })
      this.loadData()
    },
  },

  pageLifetimes: {
    show() {
      this.loadData()
    },
  },

  methods: {
    loadData() {
      const { year, month, typeIndex } = this.data
      const allRecords = getRecords()
      const type = RECORD_TYPES[typeIndex] as RecordType

      const summary = calcMonthSummary(allRecords, year, month)
      const ranking = calcCategoryRanking(allRecords, year, month, type)

      const pieData = ranking.map(r => ({
        name: r.category,
        value: r.amount,
        color: r.color,
      }))

      // Enrich ranking with budget info
      const enrichedRanking = ranking.map((r: CategoryRankItem) => {
        const budget = (type === '支出' || type === '收入')
          ? getBudgetAmount(year, month, type, r.category)
          : 0
        return {
          ...r,
          budgetAmount: budget,
          budgetText: budget > 0 ? fenToYuan(budget) : '',
          overBudget: budget > 0 && r.amount > budget,
        }
      })

      const typeTotal = ranking.reduce((s: number, r: CategoryRankItem) => s + r.amount, 0)
      const barColor = getTrendColor(type)

      this.setData({
        income: formatAmount(summary.income, true),
        expense: formatAmount(summary.expense, true),
        typeTotalText: formatAmount(typeTotal),
        pieData,
        rankingList: enrichedRanking,
        hasPieData: pieData.length > 0,
        barColor,
      })
      this.loadCompareData()
    },

    loadCompareData() {
      const { compareMode, typeIndex } = this.data
      const type = RECORD_TYPES[typeIndex] as RecordType
      const allRecords = getRecords()
      let barData: ComparisonDatum[] = []

      if (compareMode === 'weekly') {
        barData = calcWeekdayComparison(allRecords, this.data.year, this.data.month, type)
      } else if (compareMode === 'daily') {
        barData = calcDailyComparison(allRecords, this.data.year, this.data.month, type)
      } else {
        barData = calcYearlyComparison(allRecords, this.data.year, type)
      }

      this.setData({ barData, hasBarData: barData.some(d => d.value > 0) })
    },

    onPickerChange(e: any) {
      const val = e.detail.value as [number, number]
      const year = 2020 + val[0]
      const month = val[1] + 1
      this.setData({ year, month, pickerValue: val })
      this.loadData()
    },

    onMonthChange(e: any) {
      this.setData({ year: e.detail.year, month: e.detail.month })
      this.loadData()
    },

    onTypeChange(e: any) {
      const idx = (e.currentTarget.dataset as any).index as number
      this.setData({ typeIndex: idx })
      this.loadData()
    },

    onCompareModeChange(e: any) {
      const mode = (e.currentTarget.dataset as any).mode as CompareMode
      this.setData({ compareMode: mode })
      this.loadCompareData()
    },
  },
})
