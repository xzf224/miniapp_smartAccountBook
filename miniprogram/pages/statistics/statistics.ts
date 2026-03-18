import { getBudgets, getRecords, getCurrencyCode, getCurrencySymbol } from '../../utils/storage'
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
import { CATEGORY_COLORS, fenToYuan, RecordType } from '../../models/record'

type CompareMode = 'daily' | 'weekly' | 'monthly'
const STAT_TYPES: RecordType[] = ['支出', '收入']

const now = new Date()
type CompareTone = 'positive' | 'negative' | 'neutral'
type BudgetStatusTone = 'normal' | 'warning' | 'danger' | 'neutral'

interface BudgetVarianceItem {
  category: string
  budgetText: string
  spentText: string
  varianceText: string
  executionText: string
  status: BudgetStatusTone
  color: string
}

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

function getPreviousYearMonth(year: number, month: number) {
  const previous = new Date(year, month - 2, 1)
  return {
    year: previous.getFullYear(),
    month: previous.getMonth() + 1,
  }
}

function buildMoMText(current: number, previous: number) {
  if (current === 0 && previous === 0) {
    return { text: '较上月持平', tone: 'neutral' as CompareTone }
  }
  if (previous === 0) {
    return { text: '较上月新增', tone: current > 0 ? 'positive' as CompareTone : 'neutral' as CompareTone }
  }

  const changePct = ((current - previous) / previous) * 100
  const rounded = Math.abs(changePct).toFixed(1).replace(/\.0$/, '')
  if (changePct === 0) {
    return { text: '较上月持平', tone: 'neutral' as CompareTone }
  }
  return {
    text: `较上月 ${changePct > 0 ? '+' : '-'}${rounded}%`,
    tone: changePct > 0 ? 'positive' as CompareTone : 'negative' as CompareTone,
  }
}

function buildBudgetExecution(
  year: number,
  month: number,
  currencyCode: string,
  currencySymbol: string,
) {
  const budgets = getBudgets().filter(
    budget => budget.year === year
      && budget.month === month
      && budget.type === '支出'
      && budget.amount > 0,
  )
  const totalBudgetEntry = budgets.find(budget => budget.category === '__total__')
  const categoryBudgets = budgets.filter(budget => budget.category !== '__total__')
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  const expenseRecords = getRecords().filter(
    record => record.type === '支出'
      && record.date.startsWith(prefix)
      && (record.currency ?? 'CNY') === currencyCode,
  )

  const spent = expenseRecords.reduce((sum, record) => sum + record.amount, 0)
  const spentByCategory = expenseRecords.reduce<Record<string, number>>((sum, record) => {
    sum[record.category] = (sum[record.category] || 0) + record.amount
    return sum
  }, {})

  const categoryVarianceTop = categoryBudgets
    .map((budget) => {
      const categorySpent = spentByCategory[budget.category] || 0
      const variance = categorySpent - budget.amount
      const executionPct = budget.amount > 0 ? Math.round((categorySpent / budget.amount) * 100) : 0
      const status: BudgetStatusTone = categorySpent > budget.amount
        ? 'danger'
        : executionPct >= 85
          ? 'warning'
          : 'normal'

      return {
        category: budget.category,
        budgetText: formatAmount(budget.amount, true, currencySymbol),
        spentText: formatAmount(categorySpent, true, currencySymbol),
        varianceText: variance > 0
          ? `超 ${formatAmount(Math.abs(variance), true, currencySymbol)}`
          : variance < 0
            ? `余 ${formatAmount(Math.abs(variance), true, currencySymbol)}`
            : '刚好用完',
        executionText: `${executionPct}%`,
        status,
        color: CATEGORY_COLORS[budget.category] || '#FF8A00',
        priority: status === 'danger' ? 2 : status === 'warning' ? 1 : 0,
        varianceAbs: Math.abs(variance),
      }
    })
    .sort((a, b) => b.priority - a.priority || b.varianceAbs - a.varianceAbs)
    .slice(0, 3)
    .map(({ priority, varianceAbs, ...item }) => item)

  const totalBudget = totalBudgetEntry?.amount || 0
  const hasTotalBudget = totalBudget > 0
  const nowDate = new Date()
  const currentYear = nowDate.getFullYear()
  const currentMonth = nowDate.getMonth() + 1
  const daysInMonth = new Date(year, month, 0).getDate()
  const isPastMonth = year < currentYear || (year === currentYear && month < currentMonth)
  const isCurrentMonth = year === currentYear && month === currentMonth
  const elapsedDays = isPastMonth ? daysInMonth : isCurrentMonth ? nowDate.getDate() : 0
  const forecastFen = elapsedDays > 0 ? Math.round((spent / elapsedDays) * daysInMonth) : spent
  const remainFen = totalBudget - spent
  const executionPct = hasTotalBudget ? Math.round((spent / totalBudget) * 100) : 0

  let budgetStatusText = '未设总预算'
  let budgetStatusTone: BudgetStatusTone = 'neutral'
  let budgetHintText = categoryVarianceTop.length > 0
    ? `已设置 ${categoryVarianceTop.length} 项重点分类预算，可先关注分类偏差。`
    : '尚未设置预算，建议先设定本月支出总预算。'

  if (hasTotalBudget) {
    if (spent > totalBudget) {
      budgetStatusText = '已超支'
      budgetStatusTone = 'danger'
      budgetHintText = `当前已超出 ${formatAmount(Math.abs(remainFen), true, currencySymbol)}。`
    } else if (forecastFen > totalBudget) {
      budgetStatusText = '预计超支'
      budgetStatusTone = 'warning'
      budgetHintText = `按当前节奏，月末预计超出 ${formatAmount(forecastFen - totalBudget, true, currencySymbol)}。`
    } else if (executionPct >= 85) {
      budgetStatusText = '接近上限'
      budgetStatusTone = 'warning'
      budgetHintText = `当前已用 ${executionPct}%，建议放缓后续支出。`
    } else {
      budgetStatusText = '执行健康'
      budgetStatusTone = 'normal'
      budgetHintText = `当前已用 ${executionPct}%，预算仍在可控范围。`
    }
  }

  return {
    budgetExecutionVisible: hasTotalBudget || categoryVarianceTop.length > 0,
    hasTotalBudget,
    budgetTotalText: hasTotalBudget ? formatAmount(totalBudget, true, currencySymbol) : '未设置',
    budgetSpentText: formatAmount(spent, true, currencySymbol),
    budgetRemainText: hasTotalBudget ? formatAmount(Math.abs(remainFen), true, currencySymbol) : '--',
    budgetForecastText: formatAmount(forecastFen, true, currencySymbol),
    budgetExecutionPctText: hasTotalBudget ? `${executionPct}%` : '--',
      budgetRemainLabel: hasTotalBudget ? (remainFen >= 0 ? '剩余' : '超出') : '总预算',
      budgetForecastLabel: isPastMonth ? '当月实际支出' : '预计月末支出',
      budgetStatusText,
      budgetStatusTone,
      budgetHintText,
      budgetVarianceTop: categoryVarianceTop,
    }
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
    incomeMoMText: '较上月持平',
    incomeMoMTone: 'neutral' as CompareTone,
    expenseMoMText: '较上月持平',
    expenseMoMTone: 'neutral' as CompareTone,
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
    budgetExecutionVisible: false,
    hasTotalBudget: false,
    budgetTotalText: '未设置',
    budgetSpentText: '¥ 0',
    budgetRemainText: '--',
    budgetForecastText: '¥ 0',
    budgetExecutionPctText: '--',
    budgetRemainLabel: '总预算',
    budgetForecastLabel: '预计月末支出',
    budgetStatusText: '未设总预算',
    budgetStatusTone: 'neutral' as BudgetStatusTone,
    budgetHintText: '',
    budgetVarianceTop: [] as BudgetVarianceItem[],
    hasPieData: false,
    hasBarData: false,
  },

  lifetimes: {
    attached() {
      this.setData({ statusBarHeight: getStatusBarHeight(), currencySymbol: getCurrencySymbol() })
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
      const previousMonth = getPreviousYearMonth(year, month)

      const summary = calcMonthSummary(allRecords, year, month, currentCurrencyCode)
      const previousSummary = calcMonthSummary(allRecords, previousMonth.year, previousMonth.month, currentCurrencyCode)
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
      const incomeMoM = buildMoMText(summary.income, previousSummary.income)
      const rawExpenseMoM = buildMoMText(summary.expense, previousSummary.expense)
      const expenseMoM = {
        text: rawExpenseMoM.text,
        tone: rawExpenseMoM.tone === 'positive'
          ? 'negative'
          : rawExpenseMoM.tone === 'negative'
            ? 'positive'
            : 'neutral' as CompareTone,
      }
      const budgetExecution = buildBudgetExecution(year, month, currentCurrencyCode, currencySymbol)

      this.setData({
        income: formatAmount(summary.income, true, currencySymbol),
        expense: formatAmount(summary.expense, true, currencySymbol),
        incomeMoMText: incomeMoM.text,
        incomeMoMTone: incomeMoM.tone,
        expenseMoMText: expenseMoM.text,
        expenseMoMTone: expenseMoM.tone,
        typeTotalText: formatAmount(typeTotal),
        pieData,
        topCategories,
        selectedCategoryName: selectedCategory?.category || '',
        selectedCategoryAmountText: selectedCategory?.amountText || '',
        selectedCategoryPercentageText: selectedCategory?.percentageText || '',
        selectedCategoryColor: selectedCategory?.color || '',
        hasPieData: pieData.length > 0,
        barColor,
        ...budgetExecution,
      })
      this.loadCompareData()
    },

    loadCompareData() {
      const { compareMode, typeIndex, currencySymbol } = this.data
      const type = this.data.types[typeIndex] as RecordType
      const allRecords = getRecords()
      const currentCurrencyCode = getCurrencyCode()
      let barData: ComparisonDatum[] = []

      if (compareMode === 'weekly') {
        barData = calcWeekdayComparison(allRecords, this.data.year, this.data.month, type, currentCurrencyCode)
      } else if (compareMode === 'daily') {
        barData = calcDailyComparison(allRecords, this.data.year, this.data.month, type, currentCurrencyCode)
      } else {
        barData = calcYearlyComparison(allRecords, this.data.year, type, currentCurrencyCode)
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
