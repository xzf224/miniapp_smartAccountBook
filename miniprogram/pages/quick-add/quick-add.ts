import { addRecord, getCategories, getCurrencyCode, getCurrencySymbol, CURRENCIES } from '../../utils/storage'
import { CATEGORY_COLORS, CATEGORY_ICONS, generateId, yuanToFen } from '../../models/record'
import { getToday } from '../../utils/date'

type QuickType = '支出' | '收入'

interface QuickCategoryItem {
  name: string
  displayName: string
  icon: string
  color: string
  bgColor: string
  isMore?: boolean
}

const DISPLAY_NAME_MAP: Record<string, string> = {
  '生活缴费': '水电',
}

const BG_COLOR_MAP: Record<string, string> = {
  '餐饮': '#FFF2EC',
  '交通': '#EEF4FF',
  '购物': '#F3EDFF',
  '娱乐': '#EAFBF1',
  '生活缴费': '#FFF6E8',
  '医疗': '#FFF0F2',
  '教育': '#EEF5FF',
  '工资': '#EAFBF1',
  '奖金': '#FFF6E8',
  '兼职': '#EEF4FF',
  '报销': '#F3EDFF',
  '退款': '#EAFBF1',
  '投资': '#FFF2EC',
  '红包': '#FFF0F2',
}

Component({
  data: {
    typeIndex: 0,
    types: ['支出', '收入'],
    categories: [] as string[],
    quickCategories: [] as QuickCategoryItem[],
    gridHeight: 286,
    fullGridHeight: 286,
    categoryGridExpanded: false,
    hasMoreCategories: false,
    selectedCategory: '',
    amountDisplay: '0.00',
    date: getToday(),
    note: '',
    currencySymbol: '¥',
    currencyCode: 'CNY',
    currencyName: '人民币',
    currencyPickerIndex: 0,
    currencyLabels: CURRENCIES.map(c => `${c.symbol}  ${c.name}（${c.code}）`),
    quickAmounts: [10, 20, 50, 100],
    canSave: false,
  },

  lifetimes: {
    attached() {
      this.loadCategories()
      this.syncCurrencyState()
    },
  },

  pageLifetimes: {
    show() {
      this.loadCategories()
      this.syncCurrencyState()
    },
  },

  methods: {
    getCanSave(amountDisplay: string, selectedCategory: string): boolean {
      const amount = parseFloat(amountDisplay)
      return !!selectedCategory && !Number.isNaN(amount) && amount > 0
    },

    syncAmountState(amountDisplay: string, selectedCategory = this.data.selectedCategory) {
      this.setData({
        amountDisplay,
        canSave: this.getCanSave(amountDisplay, selectedCategory),
      })
    },

    syncCurrencyState() {
      const code = getCurrencyCode()
      const idx = CURRENCIES.findIndex(c => c.code === code)
      const currency = CURRENCIES[idx >= 0 ? idx : 0]
      this.setData({
        currencySymbol: currency.symbol || getCurrencySymbol(code),
        currencyCode: currency.code,
        currencyName: currency.name,
        currencyPickerIndex: idx >= 0 ? idx : 0,
      })
    },

    normalizeAmountInput(rawValue: string, padDecimal = false): string {
      const sanitized = rawValue.replace(/[^\d.]/g, '')
      const firstDotIndex = sanitized.indexOf('.')
      const normalized = firstDotIndex === -1
        ? sanitized
        : `${sanitized.slice(0, firstDotIndex + 1)}${sanitized.slice(firstDotIndex + 1).replace(/\./g, '')}`
      const [integerPart = '', decimalPart = ''] = normalized.split('.')

      if (!normalized) return ''
      if (!normalized.includes('.')) return normalized

      const safeIntegerPart = integerPart || '0'
      const trimmedDecimal = decimalPart.slice(0, 2)
      if (!padDecimal) {
        return `${safeIntegerPart}.${trimmedDecimal}`
      }
      return `${safeIntegerPart}.${trimmedDecimal.padEnd(2, '0')}`
    },

    loadCategories() {
      const cats = getCategories()
      const type = this.data.types[this.data.typeIndex] as QuickType
      const categories = cats[type] || []
      const quickCategories: QuickCategoryItem[] = categories.map((name: string): QuickCategoryItem => ({
        name,
        displayName: DISPLAY_NAME_MAP[name] || name,
        icon: CATEGORY_ICONS[name] || name.slice(0, 1),
        color: CATEGORY_COLORS[name] || '#FF8A00',
        bgColor: BG_COLOR_MAP[name] || '#F5F6F8',
      }))

      const selectedCategory = quickCategories.some(item => item.name === this.data.selectedCategory)
        ? this.data.selectedCategory
        : (quickCategories[0]?.name || '')

      const collapsedRowCount = 2
      const totalRowCount = Math.max(collapsedRowCount, Math.ceil(quickCategories.length / 4))
      const collapsedGridHeight = collapsedRowCount * 134 + 18
      const fullGridHeight = totalRowCount * 134 + 18
      const hasMoreCategories = totalRowCount > collapsedRowCount
      const categoryGridExpanded = hasMoreCategories ? this.data.categoryGridExpanded : false
      const gridHeight = categoryGridExpanded ? fullGridHeight : Math.min(fullGridHeight, collapsedGridHeight)

      this.setData({
        categories,
        quickCategories,
        selectedCategory,
        gridHeight,
        fullGridHeight,
        hasMoreCategories,
        categoryGridExpanded,
        canSave: this.getCanSave(this.data.amountDisplay, selectedCategory),
      })
    },

    onTypeChange(e: WechatMiniprogram.TouchEvent) {
      const idx = Number((e.currentTarget.dataset || {}).index)
      this.setData({
        typeIndex: idx,
        selectedCategory: '',
        categoryGridExpanded: false,
      })
      this.loadCategories()
    },

    onQuickCategoryTap(e: WechatMiniprogram.TouchEvent) {
      const { name } = e.currentTarget.dataset as { name: string }
      this.setData({
        selectedCategory: name,
        canSave: this.getCanSave(this.data.amountDisplay, name),
      })
    },

    onDateChange(e: WechatMiniprogram.PickerChange) {
      this.setData({ date: e.detail.value as string })
    },

    onNoteInput(e: WechatMiniprogram.Input) {
      this.setData({ note: e.detail.value })
    },

    onAmountInput(e: WechatMiniprogram.Input) {
      const amountDisplay = this.normalizeAmountInput(e.detail.value, false)
      ;(this as any)._amountDraft = amountDisplay
      this.syncAmountState(amountDisplay)
    },

    onAmountFocus() {
      if (this.data.amountDisplay === '0.00') {
        this.syncAmountState('')
      }
    },

    onAmountBlur(e: WechatMiniprogram.InputBlur) {
      const amountDisplay = this.normalizeAmountInput(e.detail.value, true) || '0.00'
      ;(this as any)._amountDraft = amountDisplay
      this.syncAmountState(amountDisplay)
    },

    onQuickAmountTap(e: WechatMiniprogram.TouchEvent) {
      const value = Number((e.currentTarget.dataset || {}).value || 0)
      const current = parseFloat((this as any)._amountDraft || this.data.amountDisplay || '0')
      const nextAmount = (Number.isNaN(current) ? 0 : current) + value
      const amountDisplay = nextAmount.toFixed(2)
      ;(this as any)._amountDraft = amountDisplay
      this.syncAmountState(amountDisplay)
    },

    onToggleCategoryGrid() {
      const nextExpanded = !this.data.categoryGridExpanded
      const collapsedGridHeight = 2 * 134 + 18
      this.setData({
        categoryGridExpanded: nextExpanded,
        gridHeight: nextExpanded ? this.data.fullGridHeight : Math.min(this.data.fullGridHeight, collapsedGridHeight),
      })
    },

    onClose() {
      wx.reLaunch({ url: '/pages/home/home' })
    },

    onSave() {
      const draftAmount = (this as any)._amountDraft as string | undefined
      const { selectedCategory, date, note, typeIndex } = this.data
      const amountDisplay = draftAmount || this.data.amountDisplay
      const amount = parseFloat(amountDisplay)
      if (!selectedCategory || selectedCategory === '__more__') {
        wx.showToast({ title: '请选择分类', icon: 'none' })
        return
      }
      if (!amountDisplay || Number.isNaN(amount) || amount <= 0) {
        wx.showToast({ title: '请输入正确金额', icon: 'none' })
        return
      }

      const now = Date.now()
      addRecord({
        id: generateId(),
        type: this.data.types[typeIndex] as QuickType,
        category: selectedCategory,
        amount: yuanToFen(amount),
        date,
        note,
        currency: this.data.currencyCode,
        createTime: now,
        updateTime: now,
      })

      wx.showToast({ title: '已保存', icon: 'success' })
      ;(this as any)._amountDraft = '0.00'
      this.setData({
        date: getToday(),
        note: '',
      })
      this.syncAmountState('0.00')
      setTimeout(() => wx.reLaunch({ url: '/pages/home/home' }), 400)
    },

    onCurrencyChange(e: any) {
      const idx = e.detail.value as number
      const currency = CURRENCIES[idx]
      this.setData({
        currencySymbol: currency.symbol,
        currencyCode: currency.code,
        currencyName: currency.name,
        currencyPickerIndex: idx,
      })
    },
  },
})
