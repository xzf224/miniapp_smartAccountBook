import { getRecords, deleteRecord, getBudgets, getPendingDrafts, getCurrencySymbol, getCurrencyCode } from '../../utils/storage'
import { checkRecurringRules } from '../../utils/recurring'
import { groupRecordsByDate } from '../../utils/date'
import { fenToYuan } from '../../models/record'
import { PICKER_YEARS, PICKER_MONTHS } from '../../utils/constants'
import { getBudgetAlertBanner, getBudgetAlertForPeriod } from '../../utils/budget-alert'

const now = new Date()

function getExactBudgetAmount(year: number, month: number, type: '支出' | '收入', category: string): number {
  const entry = getBudgets().find(
    budget => budget.year === year
      && budget.month === month
      && budget.type === type
      && budget.category === category,
  )
  return entry ? entry.amount : 0
}

function formatRecordDateTime(record: any): string {
  const timestamp = record.updateTime || record.createTime
  if (!timestamp) return record.date || ''
  const value = new Date(timestamp)
  if (Number.isNaN(value.getTime())) return record.date || ''
  const timeText = `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
  return `${record.date} ${timeText}`
}

Component({
  data: {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    daysLeft: 0,
    income: '0.00',
    expense: '0.00',
    balance: '0.00',
    expenseBudget: 0,
    expenseRaw: 0,
    groups: [] as any[],
    isEmpty: true,
    pickerRange: [PICKER_YEARS, PICKER_MONTHS] as string[][],
    pickerValue: [now.getFullYear() - 2020, now.getMonth()] as number[],
    searchVisible: false,
    searchKeyword: '',
    searchTypeIndex: 0,
    searchTypes: ['全部', '支出', '收入'],
    searchResultCount: 0,
    amountMin: '',
    amountMax: '',
    dateStart: '',
    dateEnd: '',
    pendingDraftCount: 0,
    analysisItems: [] as any[],
    analysisExpanded: false,
    currencySymbol: '¥',
    mixedCurrencyCount: 0,
    budgetAlertVisible: false,
    budgetAlertTone: 'warning',
    budgetAlertTitle: '',
    budgetAlertText: '',
  },

  lifetimes: {
    attached() {
      this.loadData()
    },
  },

  pageLifetimes: {
    show() {
      checkRecurringRules()
      this.setData({ currencySymbol: getCurrencySymbol() })
      this.loadData()
    },
  },

  methods: {
    loadData() {
      const { year, month, searchKeyword, searchTypeIndex } = this.data
      const allRecords = getRecords()
      const monthStr = `${year}-${String(month).padStart(2, '0')}`
      let monthRecords = allRecords.filter((r: any) => r.date.startsWith(monthStr))

      // 搜索过滤
      const keyword = searchKeyword.trim().toLowerCase()
      if (keyword) {
        monthRecords = monthRecords.filter((r: any) =>
          r.note.toLowerCase().includes(keyword) || r.category.toLowerCase().includes(keyword)
        )
      }
      if (searchTypeIndex === 1) monthRecords = monthRecords.filter((r: any) => r.type === '支出')
      else if (searchTypeIndex === 2) monthRecords = monthRecords.filter((r: any) => r.type === '收入')

      const { amountMin, amountMax, dateStart, dateEnd } = this.data
      const minFen = amountMin ? Math.round(parseFloat(amountMin) * 100) : 0
      const maxFen = amountMax ? Math.round(parseFloat(amountMax) * 100) : Infinity
      if (amountMin || amountMax) {
        monthRecords = monthRecords.filter((r: any) => r.amount >= minFen && r.amount <= maxFen)
      }
      if (dateStart) monthRecords = monthRecords.filter((r: any) => r.date >= dateStart)
      if (dateEnd) monthRecords = monthRecords.filter((r: any) => r.date <= dateEnd)

      const currentCurrencyCode = getCurrencyCode()
      let incomeTotal = 0
      let expenseTotal = 0
      let mixedCurrencyCount = 0
      monthRecords.forEach((r: any) => {
        if ((r.currency ?? 'CNY') !== currentCurrencyCode) { mixedCurrencyCount++; return }
        if (r.type === '收入') incomeTotal += r.amount
        else if (r.type === '支出') expenseTotal += r.amount
      })

      const groups = groupRecordsByDate(monthRecords.map((record: any) => ({
        ...record,
        timeText: formatRecordDateTime(record),
      })) as any, currentCurrencyCode)
      const expenseBudget = getExactBudgetAmount(year, month, '支出', '__total__')
      const budgetAlert = getBudgetAlertForPeriod(year, month, currentCurrencyCode)
      const budgetAlertBanner = budgetAlert ? getBudgetAlertBanner(budgetAlert) : null

      const pendingDraftCount = getPendingDrafts().length

      const nowDate = new Date()
      const currentYear = nowDate.getFullYear()
      const currentMonth = nowDate.getMonth() + 1
      const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()
      const daysLeft = daysInMonth - nowDate.getDate()

      // 按分类汇总支出，计算百分比（仅统计当前货币）
      const categoryMap: Record<string, number> = {}
      monthRecords.filter((r: any) => r.type === '支出' && (r.currency ?? 'CNY') === currentCurrencyCode).forEach((r: any) => {
        categoryMap[r.category] = (categoryMap[r.category] || 0) + r.amount
      })
      const total = Object.values(categoryMap).reduce((a: number, b: number) => a + b, 0)
      const colours = ['#FF7D00', '#4CAF50', '#2196F3', '#9C27B0', '#FF5722', '#5B8FF9', '#E86452', '#6DC8EC', '#945FB9', '#FF9845']
      const analysisItems = Object.entries(categoryMap)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .map(([category, amount], i) => ({
          category,
          amountText: fenToYuan(amount as number),
          percent: total > 0 ? Math.round(((amount as number) / total) * 100) : 0,
          color: colours[i % colours.length],
        }))
      this.setData({ analysisItems })

      this.setData({
        income: fenToYuan(incomeTotal),
        expense: fenToYuan(expenseTotal),
        balance: fenToYuan(incomeTotal - expenseTotal),
        expenseRaw: expenseTotal,
        expenseBudget,
        groups,
        isEmpty: monthRecords.length === 0,
        searchResultCount: monthRecords.length,
        pendingDraftCount,
        daysLeft,
        mixedCurrencyCount,
        budgetAlertVisible: Boolean(budgetAlertBanner),
        budgetAlertTone: budgetAlertBanner?.tone || 'warning',
        budgetAlertTitle: budgetAlertBanner?.title || '',
        budgetAlertText: budgetAlertBanner?.text || '',
      })
    },

    onMonthChange(e: any) {
      this.setData({ year: e.detail.year, month: e.detail.month })
      this.loadData()
    },

    onPickerChange(e: any) {
      const val = e.detail.value as [number, number]
      const year = 2020 + val[0]
      const month = val[1] + 1
      this.setData({ year, month, pickerValue: val })
      this.loadData()
    },

    onSearchToggle() {
      wx.navigateTo({ url: '/pages/records/records' })
    },

    onSearchInput(e: WechatMiniprogram.Input) {
      this.setData({ searchKeyword: e.detail.value })
      this.loadData()
    },

    onSearchClear() {
      this.setData({ searchKeyword: '' })
      this.loadData()
    },

    onSearchTypeChange(e: WechatMiniprogram.TouchEvent) {
      const idx = (e.currentTarget.dataset as any).index as number
      this.setData({ searchTypeIndex: idx })
      this.loadData()
    },

    onAmountMinInput(e: WechatMiniprogram.Input) {
      this.setData({ amountMin: e.detail.value })
      this.loadData()
    },

    onAmountMaxInput(e: WechatMiniprogram.Input) {
      this.setData({ amountMax: e.detail.value })
      this.loadData()
    },

    onDateStartChange(e: WechatMiniprogram.PickerChange) {
      this.setData({ dateStart: e.detail.value as string })
      this.loadData()
    },

    onDateEndChange(e: WechatMiniprogram.PickerChange) {
      this.setData({ dateEnd: e.detail.value as string })
      this.loadData()
    },

    onDateRangeClear() {
      this.setData({ dateStart: '', dateEnd: '' })
      this.loadData()
    },

    onRecordEdit(e: any) {
      const id = (e.currentTarget.dataset as any).id as string
      wx.navigateTo({ url: `/pages/add-record/add-record?id=${id}` })
    },

    onRecordDelete(e: any) {
      const id = (e.currentTarget.dataset as any).id as string
      wx.showModal({
        title: '确认删除',
        content: '删除后不可恢复',
        success: (res: WechatMiniprogram.ShowModalSuccessCallbackResult) => {
          if (res.confirm) {
            deleteRecord(id)
            this.loadData()
          }
        },
      })
    },

    onViewDrafts() {
      wx.navigateTo({ url: '/pages/pending-drafts/pending-drafts' })
    },

    onManual() {
      wx.reLaunch({ url: '/pages/quick-add/quick-add' })
    },

    onVoice() {
      wx.navigateTo({ url: '/pages/voice-input/voice-input' })
    },

    onPhoto() {
      wx.navigateTo({ url: '/pages/photo-scan/photo-scan' })
    },

    onToggleAnalysis() {
      this.setData({ analysisExpanded: !this.data.analysisExpanded })
    },

    onViewAllRecords() {
      wx.navigateTo({ url: '/pages/records/records' })
    },

    onOpenStatistics() {
      wx.reLaunch({ url: '/pages/statistics/statistics' })
    },

    onOpenBudget() {
      wx.reLaunch({ url: '/pages/budget/budget' })
    },
  },
})
