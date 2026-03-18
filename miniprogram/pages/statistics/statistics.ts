import { getRecords, getCurrencyCode, getCurrencySymbol } from '../../utils/storage'
import { PICKER_YEARS, PICKER_MONTHS } from '../../utils/constants'
import {
  calcMonthSummary,
  calcCategoryRanking,
  calcDailyComparison,
  calcWeekdayComparison,
  calcYearlyComparison,
  ComparisonDatum,
  CategoryRankItem,
} from '../../utils/statistics'
import { fenToYuan, RecordType } from '../../models/record'

type CompareMode = 'daily' | 'weekly' | 'monthly'
const STAT_TYPES: RecordType[] = ['支出', '收入']

const now = new Date()

function getStatusBarHeight(): number {
  const wxApi = wx as any
  const info = typeof wxApi.getWindowInfo === 'function'
    ? wxApi.getWindowInfo()
    : wx.getSystemInfoSync()
  return info.statusBarHeight || info.safeArea?.top || 0
}

function formatAmount(fen: number, withCurrency = false, symbol = '¥'): string {
  const normalized = fenToYuan(fen)
  const trimmed = normalized.includes('.')
    ? normalized.replace(/\.00$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
    : normalized
  const [integerPart, decimalPart] = trimmed.split('.')
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const amount = decimalPart ? `${groupedInteger}.${decimalPart}` : groupedInteger
  return withCurrency ? `${symbol} ${amount}` : amount
}

function getTrendColor(type: RecordType): string {
  if (type === '收入') return '#2ECC71'
  if (type === '不计入收支') return '#5B8FF9'
  return '#FF8A00'
}

function getCompareModeLabel(mode: CompareMode): string {
  if (mode === 'daily') return '日'
  if (mode === 'monthly') return '月'
  return '周'
}

function getCompareModePeriodName(mode: CompareMode): string {
  if (mode === 'daily') return '日期'
  if (mode === 'monthly') return '月份'
  return '星期'
}

Component({
  data: {
    statusBarHeight: 0,
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    pickerRange: [PICKER_YEARS, PICKER_MONTHS] as string[][],
    pickerValue: [now.getFullYear() - 2020, now.getMonth()] as number[],
    typeIndex: 0,
    types: STAT_TYPES,
    currencySymbol: '¥',
    income: '¥ 0',
    expense: '¥ 0',
    typeTotalText: '0',
    pieData: [] as Array<{ name: string; value: number; color: string }>,
    topCategories: [] as Array<{
      rank: number
      category: string
      amountText: string
      percentageText: string
      color: string
    }>,
    selectedCategoryName: '',
    selectedCategoryAmountText: '',
    selectedCategoryPercentageText: '',
    selectedCategoryColor: '',
    compareMode: 'weekly' as CompareMode,
    compareTabs: [
      { mode: 'weekly', label: '周' },
      { mode: 'daily', label: '月' },
      { mode: 'monthly', label: '年' },
    ] as Array<{ mode: CompareMode; label: string }>,
    barData: [] as ComparisonDatum[],
    barColor: getTrendColor('支出'),
    selectedBarIndex: -1,
    trendSelectedLabel: '--',
    trendSelectedValueText: '',
    trendPeakLabel: '',
    trendPeakValueText: '',
    trendAverageValueText: '',
    trendActiveCountText: '0',
    compareModeLabel: getCompareModeLabel('weekly'),
    compareModePeriodName: getCompareModePeriodName('weekly'),
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
      this.setData({ currencySymbol: getCurrencySymbol() })
      this.loadData()
    },
  },

  methods: {
    loadData() {
      const { year, month, typeIndex, currencySymbol } = this.data
      const allRecords = getRecords()
      const type = this.data.types[typeIndex] as RecordType
      const currentCurrencyCode = getCurrencyCode()

      const summary = calcMonthSummary(allRecords, year, month, currentCurrencyCode)
      const ranking = calcCategoryRanking(allRecords, year, month, type, currentCurrencyCode)

      const pieData = ranking.map(r => ({
        name: r.category,
        value: r.amount,
        color: r.color,
      }))
      const topCategories = ranking.slice(0, 3).map((item, index) => ({
        rank: index + 1,
        category: item.category,
        amountText: formatAmount(item.amount, true, currencySymbol),
        percentageText: `${item.percentage}%`,
        color: item.color,
      }))
      const currentSelectedName = this.data.selectedCategoryName
      const selectedCategory = topCategories.find(item => item.category === currentSelectedName) || topCategories[0]

      const typeTotal = ranking.reduce((s: number, r: CategoryRankItem) => s + r.amount, 0)
      const barColor = getTrendColor(type)

      this.setData({
        income: formatAmount(summary.income, true, currencySymbol),
        expense: formatAmount(summary.expense, true, currencySymbol),
        typeTotalText: formatAmount(typeTotal),
        pieData,
        topCategories,
        selectedCategoryName: selectedCategory?.category || '',
        selectedCategoryAmountText: selectedCategory?.amountText || '',
        selectedCategoryPercentageText: selectedCategory?.percentageText || '',
        selectedCategoryColor: selectedCategory?.color || '',
        hasPieData: pieData.length > 0,
        barColor,
      })
      this.loadCompareData()
    },

    loadCompareData() {
      const { compareMode, typeIndex, currencySymbol } = this.data
      const type = this.data.types[typeIndex] as RecordType
      const allRecords = getRecords()
      let barData: ComparisonDatum[] = []

      if (compareMode === 'weekly') {
        barData = calcWeekdayComparison(allRecords, this.data.year, this.data.month, type)
      } else if (compareMode === 'daily') {
        barData = calcDailyComparison(allRecords, this.data.year, this.data.month, type)
      } else {
        barData = calcYearlyComparison(allRecords, this.data.year, type)
      }

      const activeBars = barData.filter(d => d.value > 0)
      const peakDatum = activeBars.reduce<ComparisonDatum | null>(
        (best, item) => (!best || item.value > best.value ? item : best),
        null,
      )
      const peakIndex = peakDatum ? barData.findIndex(item => item.label === peakDatum.label) : -1
      const average = activeBars.length > 0
        ? Math.round(activeBars.reduce((sum, item) => sum + item.value, 0) / activeBars.length)
        : 0

      this.setData({
        barData,
        selectedBarIndex: peakIndex,
        trendSelectedLabel: peakDatum?.label || '--',
        trendSelectedValueText: peakDatum ? formatAmount(peakDatum.value, true, currencySymbol) : '',
        hasBarData: activeBars.length > 0,
        trendPeakLabel: peakDatum?.label || '--',
        trendPeakValueText: peakDatum ? formatAmount(peakDatum.value, true, currencySymbol) : '',
        trendAverageValueText: formatAmount(average, true, currencySymbol),
        trendActiveCountText: `${activeBars.length}`,
        compareModeLabel: getCompareModeLabel(compareMode),
        compareModePeriodName: getCompareModePeriodName(compareMode),
      })
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

    onSummaryTypeTap(e: WechatMiniprogram.TouchEvent) {
      const type = (e.currentTarget.dataset as { type?: RecordType }).type
      if (!type) return
      const idx = this.data.types.findIndex(item => item === type)
      if (idx < 0 || idx === this.data.typeIndex) return
      this.setData({ typeIndex: idx })
      this.loadData()
    },

    onCompareModeChange(e: any) {
      const mode = (e.currentTarget.dataset as any).mode as CompareMode
      this.setData({ compareMode: mode })
      this.loadCompareData()
    },

    onTopCategoryTap(e: WechatMiniprogram.TouchEvent) {
      const index = Number((e.currentTarget.dataset as { index?: number }).index)
      const item = this.data.topCategories[index]
      if (!item) return
      this.setData({
        selectedCategoryName: item.category,
        selectedCategoryAmountText: item.amountText,
        selectedCategoryPercentageText: item.percentageText,
        selectedCategoryColor: item.color,
      })
    },

    onPieCategorySelect(
      e: WechatMiniprogram.CustomEvent<{
        name: string
        amountText: string
        percentageText: string
        color: string
      }>
    ) {
      const { name, amountText, percentageText, color } = e.detail
      this.setData({
        selectedCategoryName: name,
        selectedCategoryAmountText: amountText,
        selectedCategoryPercentageText: percentageText,
        selectedCategoryColor: color,
      })
    },

    onBarSelect(e: WechatMiniprogram.CustomEvent<{ index: number; label: string; value: number }>) {
      const { index, label, value } = e.detail
      this.setData({
        selectedBarIndex: index,
        trendSelectedLabel: label,
        trendSelectedValueText: formatAmount(value, true),
      })
    },
  },
})
