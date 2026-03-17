import { addRecord, getCategories } from '../../utils/storage'
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

const QUICK_CATEGORY_PRESET: Record<QuickType, string[]> = {
  '支出': ['餐饮', '交通', '购物', '娱乐', '生活缴费', '医疗', '教育'],
  '收入': ['工资', '奖金', '兼职', '报销', '退款', '投资', '红包'],
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
    selectedCategory: '',
    amountDisplay: '0.00',
    date: getToday(),
    note: '',
  },

  lifetimes: {
    attached() {
      this.loadCategories()
    },
  },

  pageLifetimes: {
    show() {
      this.loadCategories()
    },
  },

  methods: {
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
      const preferred = QUICK_CATEGORY_PRESET[type].filter(name => categories.includes(name))
      const quickCategories: QuickCategoryItem[] = preferred.map((name: string): QuickCategoryItem => ({
        name,
        displayName: DISPLAY_NAME_MAP[name] || name,
        icon: CATEGORY_ICONS[name] || '他',
        color: CATEGORY_COLORS[name] || '#FF8A00',
        bgColor: BG_COLOR_MAP[name] || '#F5F6F8',
      }))
      quickCategories.push({
        name: '__more__',
        displayName: '更多',
        icon: '',
        color: '#9AA2AF',
        bgColor: '#F5F6F8',
        isMore: true,
      })

      const selectedCategory = quickCategories.some(item => item.name === this.data.selectedCategory)
        ? this.data.selectedCategory
        : (quickCategories[0]?.name || '')

      this.setData({
        categories,
        quickCategories,
        selectedCategory,
      })
    },

    onTypeChange(e: WechatMiniprogram.TouchEvent) {
      const idx = Number((e.currentTarget.dataset || {}).index)
      this.setData({ typeIndex: idx, selectedCategory: '' })
      this.loadCategories()
    },

    onQuickCategoryTap(e: WechatMiniprogram.TouchEvent) {
      const { name, more } = e.currentTarget.dataset as { name: string; more: boolean }
      if (more) {
        wx.navigateTo({ url: '/pages/category-manage/category-manage' })
        return
      }
      this.setData({ selectedCategory: name })
    },

    onDateChange(e: WechatMiniprogram.PickerChange) {
      this.setData({ date: e.detail.value as string })
    },

    onNoteInput(e: WechatMiniprogram.Input) {
      this.setData({ note: e.detail.value })
    },

    onAmountInput(e: WechatMiniprogram.Input) {
      ;(this as any)._amountDraft = this.normalizeAmountInput(e.detail.value, false)
    },

    onAmountFocus() {
      if (this.data.amountDisplay === '0.00') {
        this.setData({ amountDisplay: '' })
      }
    },

    onAmountBlur(e: WechatMiniprogram.InputBlur) {
      const amountDisplay = this.normalizeAmountInput(e.detail.value, true) || '0.00'
      ;(this as any)._amountDraft = amountDisplay
      this.setData({ amountDisplay })
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
        createTime: now,
        updateTime: now,
      })

      wx.showToast({ title: '已保存', icon: 'success' })
      ;(this as any)._amountDraft = '0.00'
      this.setData({
        amountDisplay: '0.00',
        date: getToday(),
        note: '',
      })
      setTimeout(() => wx.reLaunch({ url: '/pages/home/home' }), 400)
    },
  },
})
