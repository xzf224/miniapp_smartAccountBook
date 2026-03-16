import { getRecords } from '../../utils/storage'
import { groupRecordsByDate } from '../../utils/date'

Component({
  data: {
    groups: [] as any[],
    keyword: '',
    activeFilter: 'all',
    filters: [
      { key: 'all', label: '全部' },
      { key: 'expense', label: '支出' },
      { key: 'income', label: '收入' },
      { key: 'month', label: '本月' },
    ],
    // 高级筛选面板
    showFilter: false,
    hasAdvancedFilter: false,
    // 面板内临时状态
    filterType: 'all',
    filterTime: 'all',
    filterAmountMin: '',
    filterAmountMax: '',
    filterSort: 'newest',
    // 已应用的筛选状态
    appliedType: 'all',
    appliedTime: 'all',
    appliedAmountMin: '',
    appliedAmountMax: '',
    appliedSort: 'newest',
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
      { key: 'year', label: '本年' },
    ],
    sortOptions: [
      { key: 'newest', label: '最新优先' },
      { key: 'oldest', label: '最早优先' },
      { key: 'amountDesc', label: '金额最大' },
      { key: 'amountAsc', label: '金额最小' },
    ],
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
      const all = getRecords()
      const now = new Date()
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      let list = all.slice()
      const keyword = this.data.keyword.trim().toLowerCase()
      if (keyword) {
        list = list.filter((item: any) =>
          item.note.toLowerCase().includes(keyword) ||
          item.category.toLowerCase().includes(keyword)
        )
      }

      // 快速 filter pills
      if (this.data.activeFilter === 'expense') list = list.filter((item: any) => item.type === '支出')
      if (this.data.activeFilter === 'income') list = list.filter((item: any) => item.type === '收入')
      if (this.data.activeFilter === 'month') list = list.filter((item: any) => item.date.startsWith(monthStr))

      // 高级筛选
      const { appliedType, appliedTime, appliedAmountMin, appliedAmountMax, appliedSort } = this.data
      if (appliedType === 'expense') list = list.filter((item: any) => item.type === '支出')
      if (appliedType === 'income') list = list.filter((item: any) => item.type === '收入')

      if (appliedTime === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000)
        list = list.filter((item: any) => new Date(item.date) >= weekAgo)
      } else if (appliedTime === 'month') {
        list = list.filter((item: any) => item.date.startsWith(monthStr))
      } else if (appliedTime === 'year') {
        list = list.filter((item: any) => item.date.startsWith(String(now.getFullYear())))
      }

      if (appliedAmountMin) {
        const min = parseFloat(appliedAmountMin) * 100
        list = list.filter((item: any) => item.amount >= min)
      }
      if (appliedAmountMax) {
        const max = parseFloat(appliedAmountMax) * 100
        list = list.filter((item: any) => item.amount <= max)
      }

      if (appliedSort === 'oldest') list.sort((a: any, b: any) => a.date.localeCompare(b.date))
      else if (appliedSort === 'amountDesc') list.sort((a: any, b: any) => b.amount - a.amount)
      else if (appliedSort === 'amountAsc') list.sort((a: any, b: any) => a.amount - b.amount)
      // default newest: already sorted by getRecords

      const hasAdvanced = appliedType !== 'all' || appliedTime !== 'all' ||
        !!appliedAmountMin || !!appliedAmountMax || appliedSort !== 'newest'
      this.setData({ groups: groupRecordsByDate(list), hasAdvancedFilter: hasAdvanced })
    },

    onSearchInput(e: any) {
      this.setData({ keyword: e.detail.value })
      this.loadData()
    },

    onFilterTap(e: any) {
      this.setData({ activeFilter: (e.currentTarget.dataset || {}).key })
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
      })
    },

    onCloseFilter() {
      this.setData({ showFilter: false })
    },

    onChipSelect(e: any) {
      const { key, field } = e.currentTarget.dataset
      this.setData({ [field]: key })
    },

    onAmountMinInput(e: any) {
      this.setData({ filterAmountMin: e.detail.value })
    },

    onAmountMaxInput(e: any) {
      this.setData({ filterAmountMax: e.detail.value })
    },

    onResetFilter() {
      this.setData({
        filterType: 'all',
        filterTime: 'all',
        filterAmountMin: '',
        filterAmountMax: '',
        filterSort: 'newest',
      })
    },

    onConfirmFilter() {
      this.setData({
        appliedType: this.data.filterType,
        appliedTime: this.data.filterTime,
        appliedAmountMin: this.data.filterAmountMin,
        appliedAmountMax: this.data.filterAmountMax,
        appliedSort: this.data.filterSort,
        showFilter: false,
      })
      this.loadData()
    },
  },
})
