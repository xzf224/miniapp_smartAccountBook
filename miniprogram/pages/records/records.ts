import { fenToYuan } from '../../models/record'
import { getRecords, getCurrencySymbol, getCurrencyCode } from '../../utils/storage'
import { getToday, getWeekRange, groupRecordsByDate } from '../../utils/date'

const now = new Date()
const PICKER_YEARS: string[] = Array.from({ length: 11 }, (_, i) => `${2020 + i}年`)
const PICKER_MONTHS: string[] = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

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
    groups: [] as any[],
    keyword: '',
    // 月份日期控件
    year: now.getFullYear(),
    selectedMonth: now.getMonth() + 1,
    pickerRange: [PICKER_YEARS, PICKER_MONTHS] as string[][],
    pickerValue: [now.getFullYear() - 2020, now.getMonth()] as number[],
    // 高级筛选面板
    showFilter: false,
    hasAdvancedFilter: false,
    filterPreviewCount: 0,
    // 面板内临时状态
    filterType: 'all',
    filterTime: 'all',
    filterAmountMin: '',
    filterAmountMax: '',
    filterSort: 'newest',
    filterDateStart: '',
    filterDateEnd: '',
    // 已应用的筛选状态
    appliedType: 'all',
    appliedTime: 'all',
    appliedAmountMin: '',
    appliedAmountMax: '',
    appliedSort: 'newest',
    appliedDateStart: '',
    appliedDateEnd: '',
    // 选项列表
    typeOptions: [
      { key: 'all', label: '全部' },
      { key: 'expense', label: '支出' },
      { key: 'income', label: '收入' },
    ],
    timeOptions: [
      { key: 'all', label: '不限' },
      { key: 'week', label: '本周' },
      { key: 'month', label: '本月' },
    ],
    sortOptions: [
      { key: 'newest', label: '最新' },
      { key: 'oldest', label: '最早' },
      { key: 'amountDesc', label: '金额↓' },
      { key: 'amountAsc', label: '金额↑' },
    ],
    summaryCount: 0,
    summaryDays: 0,
    summaryExpenseText: '0.00',
    summaryIncomeText: '0.00',
    summaryNetText: '0.00',
    summaryNetNegative: true,
    summaryNetClass: 'hero-text-neutral',
    currencySymbol: '¥',
    appliedTags: [] as Array<{ key: string; label: string }>,
    mixedCurrencyCount: 0,
  },

  lifetimes: {
    attached() {
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
    getOptionLabel(options: Array<{ key: string; label: string }>, key: string) {
      return (options.find(item => item.key === key) || {}).label || ''
    },

    countAdvancedFilters(state: Record<string, any>) {
      let count = 0
      if (state.appliedType !== 'all') count += 1
      if (state.appliedTime !== 'all') count += 1
      if (state.appliedDateStart || state.appliedDateEnd) count += 1
      if (state.appliedAmountMin || state.appliedAmountMax) count += 1
      if (state.appliedSort !== 'newest') count += 1
      return count
    },

    buildAppliedTags() {
      const tags: Array<{ key: string; label: string }> = []
      const {
        keyword,
        appliedType, appliedTime, appliedAmountMin, appliedAmountMax, appliedSort,
        appliedDateStart, appliedDateEnd,
        typeOptions, timeOptions, sortOptions,
      } = this.data

      if (keyword.trim()) tags.push({ key: 'keyword', label: `搜索:${keyword.trim()}` })
      if (appliedType !== 'all') {
        const label = this.getOptionLabel(typeOptions, appliedType)
        if (label) tags.push({ key: 'type', label: `类型:${label}` })
      }
      if (appliedTime !== 'all') {
        const label = this.getOptionLabel(timeOptions, appliedTime)
        if (label) tags.push({ key: 'time', label: `时间:${label}` })
      }
      if (appliedDateStart || appliedDateEnd) {
        tags.push({ key: 'dateRange', label: `${appliedDateStart || '...'} 至 ${appliedDateEnd || '...'}` })
      }
      if (appliedAmountMin || appliedAmountMax) {
        tags.push({ key: 'amount', label: `金额:${appliedAmountMin || '0'}-${appliedAmountMax || '不限'}` })
      }
      if (appliedSort !== 'newest') {
        const label = this.getOptionLabel(sortOptions, appliedSort)
        if (label) tags.push({ key: 'sort', label: `排序:${label}` })
      }
      return tags
    },

    buildSummary(list: any[], groups: any[], currentCurrencyCode: string) {
      let income = 0
      let expense = 0
      let mixedCurrencyCount = 0
      list.forEach((item: any) => {
        if ((item.currency ?? 'CNY') !== currentCurrencyCode) { mixedCurrencyCount++; return }
        if (item.type === '收入') income += item.amount
        if (item.type === '支出') expense += item.amount
      })
      const net = income - expense
      return {
        summaryCount: list.length,
        summaryDays: groups.length,
        summaryIncomeText: fenToYuan(income),
        summaryExpenseText: fenToYuan(expense),
        summaryNetText: fenToYuan(Math.abs(net)),
        summaryNetNegative: net < 0,
        summaryNetClass: net === 0 ? 'hero-text-neutral' : (net < 0 ? 'text-expense' : 'text-income'),
        mixedCurrencyCount,
      }
    },

    getFilteredList(filterState: Record<string, any>) {
      const curNow = new Date()
      const currentMonthStr = `${curNow.getFullYear()}-${String(curNow.getMonth() + 1).padStart(2, '0')}`
      const [weekStart, weekEnd] = getWeekRange(getToday())
      const {
        year, selectedMonth, keyword,
        typeKey, timeKey, amountMin, amountMax, sortKey,
        dateStart, dateEnd,
      } = filterState

      let list = getRecords().slice()

      const kw = (keyword || '').trim().toLowerCase()
      if (kw) {
        list = list.filter((item: any) =>
          item.note.toLowerCase().includes(kw) || item.category.toLowerCase().includes(kw)
        )
      }

      if (timeKey === 'all' && !dateStart && !dateEnd) {
        const pickerMonthStr = `${year}-${String(selectedMonth).padStart(2, '0')}`
        list = list.filter((item: any) => item.date.startsWith(pickerMonthStr))
      }

      if (typeKey === 'expense') list = list.filter((item: any) => item.type === '支出')
      if (typeKey === 'income') list = list.filter((item: any) => item.type === '收入')

      if (timeKey === 'week') {
        list = list.filter((item: any) => item.date >= weekStart && item.date <= weekEnd)
      } else if (timeKey === 'month') {
        list = list.filter((item: any) => item.date.startsWith(currentMonthStr))
      }

      if (dateStart) list = list.filter((item: any) => item.date >= dateStart)
      if (dateEnd) list = list.filter((item: any) => item.date <= dateEnd)

      if (amountMin) list = list.filter((item: any) => item.amount >= parseFloat(amountMin) * 100)
      if (amountMax) list = list.filter((item: any) => item.amount <= parseFloat(amountMax) * 100)

      if (sortKey === 'oldest') list.sort((a: any, b: any) => a.date.localeCompare(b.date))
      else if (sortKey === 'amountDesc') list.sort((a: any, b: any) => b.amount - a.amount)
      else if (sortKey === 'amountAsc') list.sort((a: any, b: any) => a.amount - b.amount)

      return list
    },

    syncFilterPreview(overrides: Record<string, any> = {}) {
      const list = this.getFilteredList({
        year: this.data.year,
        selectedMonth: this.data.selectedMonth,
        keyword: this.data.keyword,
        typeKey: overrides.filterType ?? this.data.filterType,
        timeKey: overrides.filterTime ?? this.data.filterTime,
        amountMin: overrides.filterAmountMin ?? this.data.filterAmountMin,
        amountMax: overrides.filterAmountMax ?? this.data.filterAmountMax,
        sortKey: overrides.filterSort ?? this.data.filterSort,
        dateStart: overrides.filterDateStart ?? this.data.filterDateStart,
        dateEnd: overrides.filterDateEnd ?? this.data.filterDateEnd,
      })
      this.setData({ filterPreviewCount: list.length })
    },

    loadData() {
      const {
        year, selectedMonth, keyword,
        appliedType, appliedTime, appliedAmountMin, appliedAmountMax, appliedSort,
        appliedDateStart, appliedDateEnd,
      } = this.data
      const list = this.getFilteredList({
        year,
        selectedMonth,
        keyword,
        typeKey: appliedType,
        timeKey: appliedTime,
        amountMin: appliedAmountMin,
        amountMax: appliedAmountMax,
        sortKey: appliedSort,
        dateStart: appliedDateStart,
        dateEnd: appliedDateEnd,
      })

      const currentCurrencyCode = getCurrencyCode()
      const groups = groupRecordsByDate(list.map((record: any) => ({
        ...record,
        dateTimeText: formatRecordDateTime(record),
      })) as any, currentCurrencyCode)
      const hasAdvanced = this.countAdvancedFilters(this.data) > 0

      this.setData({
        groups,
        hasAdvancedFilter: hasAdvanced,
        appliedTags: this.buildAppliedTags(),
        ...this.buildSummary(list, groups, currentCurrencyCode),
      })
    },

    // 月份日期控件
    onMonthPickerChange(e: any) {
      const val = e.detail.value as [number, number]
      const year = 2020 + val[0]
      const selectedMonth = val[1] + 1
      this.setData({
        year,
        selectedMonth,
        pickerValue: val,
        appliedTime: 'all',
        appliedDateStart: '',
        appliedDateEnd: '',
      })
      this.loadData()
    },

    onSearchInput(e: any) {
      this.setData({ keyword: e.detail.value })
      this.loadData()
    },

    onSearchClear() {
      this.setData({ keyword: '' })
      this.loadData()
    },

    // 高级筛选面板
    onOpenFilter() {
      this.setData({
        showFilter: true,
        filterType: this.data.appliedType,
        filterTime: this.data.appliedTime,
        filterAmountMin: this.data.appliedAmountMin,
        filterAmountMax: this.data.appliedAmountMax,
        filterSort: this.data.appliedSort,
        filterDateStart: this.data.appliedDateStart,
        filterDateEnd: this.data.appliedDateEnd,
      }, () => this.syncFilterPreview())
    },

    onCloseFilter() {
      this.setData({ showFilter: false })
    },

    onChipSelect(e: any) {
      const { key, field } = e.currentTarget.dataset
      const updates: Record<string, any> = { [field]: key }
      if (field === 'filterTime' && key !== 'all') {
        updates.filterDateStart = ''
        updates.filterDateEnd = ''
      }
      this.setData(updates, () => this.syncFilterPreview(updates))
    },

    onAmountMinInput(e: any) {
      const value = e.detail.value
      this.setData({ filterAmountMin: value }, () => this.syncFilterPreview({ filterAmountMin: value }))
    },

    onAmountMaxInput(e: any) {
      const value = e.detail.value
      this.setData({ filterAmountMax: value }, () => this.syncFilterPreview({ filterAmountMax: value }))
    },

    onFilterDateStartChange(e: any) {
      const value = e.detail.value as string
      this.setData({
        filterDateStart: value,
        filterTime: 'all',
      }, () => this.syncFilterPreview({ filterDateStart: value, filterTime: 'all' }))
    },

    onFilterDateEndChange(e: any) {
      const value = e.detail.value as string
      this.setData({
        filterDateEnd: value,
        filterTime: 'all',
      }, () => this.syncFilterPreview({ filterDateEnd: value, filterTime: 'all' }))
    },

    onResetFilter() {
      this.setData({
        filterType: 'all',
        filterTime: 'all',
        filterAmountMin: '',
        filterAmountMax: '',
        filterSort: 'newest',
        filterDateStart: '',
        filterDateEnd: '',
      }, () => this.syncFilterPreview({
        filterType: 'all',
        filterTime: 'all',
        filterAmountMin: '',
        filterAmountMax: '',
        filterSort: 'newest',
        filterDateStart: '',
        filterDateEnd: '',
      }))
    },

    onConfirmFilter() {
      const nextType = this.data.filterType
      const nextTime = this.data.filterTime
      const updates: Record<string, any> = {
        appliedType: nextType,
        appliedTime: nextTime,
        appliedAmountMin: this.data.filterAmountMin,
        appliedAmountMax: this.data.filterAmountMax,
        appliedSort: this.data.filterSort,
        appliedDateStart: this.data.filterDateStart,
        appliedDateEnd: this.data.filterDateEnd,
        showFilter: false,
      }
      if (nextTime !== 'all') {
        const current = new Date()
        updates.year = current.getFullYear()
        updates.selectedMonth = current.getMonth() + 1
        updates.pickerValue = [current.getFullYear() - 2020, current.getMonth()]
      }
      this.setData(updates)
      this.loadData()
    },

    onRemoveTag(e: any) {
      const key = (e.currentTarget.dataset || {}).key as string
      const updates: Record<string, any> = {}

      if (key === 'keyword') updates.keyword = ''
      if (key === 'type') updates.appliedType = 'all'
      if (key === 'time') updates.appliedTime = 'all'
      if (key === 'dateRange') {
        updates.appliedDateStart = ''
        updates.appliedDateEnd = ''
      }
      if (key === 'amount') {
        updates.appliedAmountMin = ''
        updates.appliedAmountMax = ''
      }
      if (key === 'sort') updates.appliedSort = 'newest'

      this.setData(updates)
      this.loadData()
    },
  },
})
