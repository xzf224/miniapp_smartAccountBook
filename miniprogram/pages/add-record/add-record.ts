import { getRecords, addRecord, updateRecord, getCategories, getCurrencyCode, getCurrencySymbol } from '../../utils/storage'
import { IRecord, RecordType, CATEGORY_COLORS, CATEGORY_ICONS, generateId, yuanToFen } from '../../models/record'
import { getToday } from '../../utils/date'
import { checkBudgetAlertAfterRecordsSaved, showBudgetAlertModal } from '../../utils/budget-alert'

type EditType = '支出' | '收入'

interface QuickCategoryItem {
  name: string
  displayName: string
  icon: string
  color: string
  bgColor: string
}

const EDIT_TYPES: EditType[] = ['支出', '收入']

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
    isEdit: false,
    recordId: '',
    typeIndex: 0,
    types: EDIT_TYPES,
    categories: [] as string[],
    quickCategories: [] as QuickCategoryItem[],
    gridHeight: 286,
    fullGridHeight: 286,
    categoryGridExpanded: false,
    hasMoreCategories: false,
    selectedCategory: '',
    amountText: '0.00',
    date: getToday(),
    note: '',
    currencySymbol: '¥',
    currencyCode: 'CNY',
    canSave: false,
  },

  lifetimes: {
    attached() {
      this.loadCategories()
      const code = getCurrencyCode()
      this.setData({
        currencyCode: code,
        currencySymbol: getCurrencySymbol(code),
      })
    },
  },

  pageLifetimes: {
    show() {
      this._loadFromOptions()
      this.loadCategories()
      if (!this.data.isEdit) {
        const code = getCurrencyCode()
        this.setData({
          currencyCode: code,
          currencySymbol: getCurrencySymbol(code),
        })
      }
    },
  },

  methods: {
    getCanSave(amountText: string, selectedCategory: string): boolean {
      const amountNum = parseFloat(amountText)
      return !!selectedCategory && !Number.isNaN(amountNum) && amountNum > 0
    },

    syncAmountState(amountText: string, selectedCategory = this.data.selectedCategory) {
      this.setData({
        amountText,
        canSave: this.getCanSave(amountText, selectedCategory),
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
      if (!padDecimal) return `${safeIntegerPart}.${trimmedDecimal}`
      return `${safeIntegerPart}.${trimmedDecimal.padEnd(2, '0')}`
    },

    _loadFromOptions() {
      const pages = getCurrentPages()
      const currentPage = pages[pages.length - 1] as any
      const options = currentPage.options || {}
      if (options.id && !this.data.isEdit) {
        this.loadRecord(options.id)
      }
    },

    loadCategories() {
      const cats = getCategories()
      const type = EDIT_TYPES[this.data.typeIndex]
      const categories = cats[type] || []
      const quickCategories: QuickCategoryItem[] = categories.map((name: string) => ({
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
        canSave: this.getCanSave(this.data.amountText, selectedCategory),
      })
    },

    loadRecord(id: string) {
      const records = getRecords()
      const record = records.find((r: IRecord) => r.id === id)
      if (!record) return
      const typeIndex = EDIT_TYPES.indexOf(record.type as EditType)
      this.setData({
        isEdit: true,
        recordId: id,
        typeIndex: typeIndex >= 0 ? typeIndex : 0,
        selectedCategory: record.category,
        amountText: (record.amount / 100).toFixed(2),
        date: record.date,
        note: record.note,
        currencyCode: record.currency || getCurrencyCode(),
        currencySymbol: getCurrencySymbol(record.currency || getCurrencyCode()),
        canSave: this.getCanSave((record.amount / 100).toFixed(2), record.category),
      })
      this.loadCategories()
    },

    onTypeChange(e: WechatMiniprogram.TouchEvent) {
      const idx = (e.currentTarget.dataset as any).index as number
      this.setData({
        typeIndex: idx,
        selectedCategory: '',
        categoryGridExpanded: false,
      })
      this.loadCategories()
    },

    onCategorySelect(e: WechatMiniprogram.TouchEvent) {
      const name = (e.currentTarget.dataset as any).name as string
      this.setData({
        selectedCategory: name,
        canSave: this.getCanSave(this.data.amountText, name),
      })
    },

    onAmountInput(e: WechatMiniprogram.Input) {
      this.syncAmountState(this.normalizeAmountInput(e.detail.value, false))
    },

    onAmountFocus() {
      if (this.data.amountText === '0.00') {
        this.syncAmountState('')
      }
    },

    onAmountBlur(e: WechatMiniprogram.InputBlur) {
      this.syncAmountState(this.normalizeAmountInput(e.detail.value, true) || '0.00')
    },

    onDateChange(e: any) {
      this.setData({ date: e.detail.value })
    },

    onNoteInput(e: WechatMiniprogram.Input) {
      this.setData({ note: e.detail.value })
    },

    onToggleCategoryGrid() {
      const nextExpanded = !this.data.categoryGridExpanded
      const collapsedGridHeight = 2 * 134 + 18
      this.setData({
        categoryGridExpanded: nextExpanded,
        gridHeight: nextExpanded ? this.data.fullGridHeight : Math.min(this.data.fullGridHeight, collapsedGridHeight),
      })
    },

    onSave() {
      const { selectedCategory, amountText, date, note, typeIndex, isEdit, recordId } = this.data
      if (!selectedCategory) {
        wx.showToast({ title: '请选择类别', icon: 'none' })
        return
      }
      const amountNum = parseFloat(amountText)
      if (!amountText || isNaN(amountNum) || amountNum <= 0) {
        wx.showToast({ title: '请输入正确金额', icon: 'none' })
        return
      }
      const type = EDIT_TYPES[typeIndex] as RecordType
      const now = Date.now()
      const existingRecords = isEdit ? getRecords() : []
      const existing = isEdit ? existingRecords.find((r: IRecord) => r.id === recordId) : null
      const record: IRecord = {
        id: isEdit ? recordId : generateId(),
        type,
        category: selectedCategory,
        amount: yuanToFen(amountNum),
        date,
        note,
        currency: existing?.currency ?? this.data.currencyCode,
        createTime: existing ? existing.createTime : now,
        updateTime: now,
      }
      if (isEdit) {
        updateRecord(record)
      } else {
        addRecord(record)
      }
      const alert = checkBudgetAlertAfterRecordsSaved([record])
      if (alert) {
        showBudgetAlertModal(alert, () => wx.navigateBack())
        return
      }
      wx.showToast({ title: isEdit ? '已更新' : '已保存' })
      setTimeout(() => wx.navigateBack(), 500)
    },
  },
})
