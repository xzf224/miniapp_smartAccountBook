import { getRecords, getBudgetAmount } from '../../utils/storage'
import {
  calcMonthSummary,
  calcCategoryRanking,
  calcDailyComparison,
  calcWeeklyComparison,
  calcMonthlyComparison,
  CHART_COLORS,
  CategoryRankItem,
} from '../../utils/statistics'
import { fenToYuan, RecordType, RECORD_TYPES } from '../../models/record'

type CompareMode = 'daily' | 'weekly' | 'monthly'

const now = new Date()
const PICKER_YEARS: string[] = Array.from({ length: 11 }, (_, i) => `${2020 + i}年`)
const PICKER_MONTHS: string[] = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

Component({
  data: {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    pickerRange: [PICKER_YEARS, PICKER_MONTHS] as string[][],
    pickerValue: [now.getFullYear() - 2020, now.getMonth()] as number[],
    typeIndex: 0,
    types: ['支出', '收入', '不计入收支'],
    income: '0.00',
    expense: '0.00',
    balance: '0.00',
    typeTotalText: '¥0',
    pieData: [] as Array<{ name: string; value: number; color: string }>,
    rankingList: [] as any[],
    compareMode: 'daily' as CompareMode,
    barData: [] as Array<{ label: string; value: number }>,
    barColor: CHART_COLORS[0],
    hasPieData: false,
    hasBarData: false,
  },

  lifetimes: {
    attached() {
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
      const barColor = type === '支出' ? '#FA5151' : '#1AAD19'

      this.setData({
        income: fenToYuan(summary.income),
        expense: fenToYuan(summary.expense),
        balance: fenToYuan(summary.balance),
        typeTotalText: `¥${fenToYuan(typeTotal)}`,
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
      let barData: Array<{ label: string; value: number }> = []

      if (compareMode === 'daily') {
        barData = calcDailyComparison(allRecords, this.data.year, this.data.month, type)
      } else if (compareMode === 'weekly') {
        barData = calcWeeklyComparison(allRecords, type)
      } else {
        barData = calcMonthlyComparison(allRecords, type)
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

    onTypeChange(e: WechatMiniprogram.TouchEvent) {
      const idx = (e.currentTarget.dataset as any).index as number
      this.setData({ typeIndex: idx })
      this.loadData()
    },

    onCompareModeChange(e: WechatMiniprogram.TouchEvent) {
      const mode = (e.currentTarget.dataset as any).mode as CompareMode
      this.setData({ compareMode: mode })
      this.loadCompareData()
    },
  },
})
