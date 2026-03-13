import { getRecords, deleteRecord, getBudgetAmount } from '../../utils/storage'
import { groupRecordsByDate } from '../../utils/date'
import { fenToYuan } from '../../models/record'

const now = new Date()
const PICKER_YEARS: string[] = Array.from({ length: 11 }, (_, i) => `${2020 + i}年`)
const PICKER_MONTHS: string[] = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

Component({
  data: {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
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

      let incomeTotal = 0
      let expenseTotal = 0
      monthRecords.forEach((r: any) => {
        if (r.type === '收入') incomeTotal += r.amount
        else if (r.type === '支出') expenseTotal += r.amount
      })

      const groups = groupRecordsByDate(monthRecords)
      const expenseBudget = getBudgetAmount(year, month, '支出', '__total__')

      this.setData({
        income: fenToYuan(incomeTotal),
        expense: fenToYuan(expenseTotal),
        balance: fenToYuan(incomeTotal - expenseTotal),
        expenseRaw: expenseTotal,
        expenseBudget,
        groups,
        isEmpty: monthRecords.length === 0,
        searchResultCount: monthRecords.length,
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
      const searchVisible = !this.data.searchVisible
      if (!searchVisible) {
        this.setData({ searchVisible, searchKeyword: '', searchTypeIndex: 0, amountMin: '', amountMax: '', dateStart: '', dateEnd: '' })
      } else {
        this.setData({ searchVisible })
      }
      this.loadData()
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

    onManual() {
      wx.navigateTo({ url: '/pages/add-record/add-record' })
    },

    onVoice() {
      wx.navigateTo({ url: '/pages/voice-input/voice-input' })
    },

    onPhoto() {
      wx.navigateTo({ url: '/pages/photo-scan/photo-scan' })
    },
  },
})
