import {
  getRecurringRules,
  addRecurringRule,
  updateRecurringRule,
  getCategories,
} from '../../utils/storage'
import { IRecurringRule, RecordType, RECORD_TYPES, generateId, yuanToFen } from '../../models/record'
import { getToday } from '../../utils/date'

const FREQ_OPTIONS = ['每天', '每周', '每月', '每年']
const FREQ_VALUES: IRecurringRule['frequency'][] = ['daily', 'weekly', 'monthly', 'yearly']
const DOW_OPTIONS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => `${i + 1}月`)
const DOM_OPTIONS = Array.from({ length: 31 }, (_, i) => `${i + 1}日`)

Component({
  data: {
    isEdit: false,
    ruleId: '',
    name: '',
    typeIndex: 0,
    types: RECORD_TYPES,
    categories: [] as string[],
    selectedCategory: '',
    amountText: '',
    note: '',
    freqIndex: 2,          // default: monthly
    freqOptions: FREQ_OPTIONS,
    dowIndex: 1,           // default: Monday
    dowOptions: DOW_OPTIONS,
    domIndex: 0,           // default: 1st (0-based)
    domOptions: DOM_OPTIONS,
    moyIndex: 0,           // default: January (0-based)
    moyOptions: MONTH_OPTIONS,
    startDate: '',
    endDate: '',
  },

  lifetimes: {
    attached() {
      this.setData({ startDate: getToday() })
      this._loadFromOptions()
    },
  },

  pageLifetimes: {
    show() {
      this._loadFromOptions()
    },
  },

  methods: {
    _loadFromOptions() {
      const pages = getCurrentPages()
      const currentPage = pages[pages.length - 1] as any
      const options = currentPage.options || {}
      if (options.id) {
        this.loadRule(options.id)
      } else if (!this.data.isEdit) {
        this._loadCategories()
      }
    },

    _loadCategories() {
      const cats = getCategories()
      const type = RECORD_TYPES[this.data.typeIndex]
      this.setData({ categories: cats[type] || [] })
    },

    loadRule(id: string) {
      const rules = getRecurringRules()
      const rule = rules.find(r => r.id === id)
      if (!rule) return
      const typeIndex = RECORD_TYPES.indexOf(rule.type as RecordType)
      const freqIndex = FREQ_VALUES.indexOf(rule.frequency)
      const cats = getCategories()
      this.setData({
        isEdit: true,
        ruleId: id,
        name: rule.name,
        typeIndex: typeIndex >= 0 ? typeIndex : 0,
        categories: cats[rule.type] || [],
        selectedCategory: rule.category,
        amountText: (rule.amount / 100).toString(),
        note: rule.note,
        freqIndex: freqIndex >= 0 ? freqIndex : 2,
        dowIndex: rule.dayOfWeek ?? 1,
        domIndex: (rule.dayOfMonth ?? 1) - 1,
        moyIndex: (rule.monthOfYear ?? 1) - 1,
        startDate: rule.startDate,
        endDate: rule.endDate || '',
      })
    },

    onNameInput(e: WechatMiniprogram.Input) {
      this.setData({ name: e.detail.value })
    },

    onTypeChange(e: WechatMiniprogram.TouchEvent) {
      const idx = (e.currentTarget.dataset as any).index as number
      this.setData({ typeIndex: idx, selectedCategory: '' })
      this._loadCategories()
    },

    onCategorySelect(e: any) {
      this.setData({ selectedCategory: e.detail.category })
    },

    onAmountInput(e: WechatMiniprogram.Input) {
      this.setData({ amountText: e.detail.value })
    },

    onNoteInput(e: WechatMiniprogram.Input) {
      this.setData({ note: e.detail.value })
    },

    onFreqChange(e: WechatMiniprogram.PickerChange) {
      this.setData({ freqIndex: Number(e.detail.value) })
    },

    onDowChange(e: WechatMiniprogram.PickerChange) {
      this.setData({ dowIndex: Number(e.detail.value) })
    },

    onDomChange(e: WechatMiniprogram.PickerChange) {
      this.setData({ domIndex: Number(e.detail.value) })
    },

    onMoyChange(e: WechatMiniprogram.PickerChange) {
      this.setData({ moyIndex: Number(e.detail.value) })
    },

    onStartDateChange(e: WechatMiniprogram.PickerChange) {
      this.setData({ startDate: e.detail.value as string })
    },

    onEndDateChange(e: WechatMiniprogram.PickerChange) {
      this.setData({ endDate: e.detail.value as string })
    },

    onClearEndDate() {
      this.setData({ endDate: '' })
    },

    onSave() {
      const {
        name, typeIndex, selectedCategory, amountText, note,
        freqIndex, dowIndex, domIndex, moyIndex,
        startDate, endDate, isEdit, ruleId,
      } = this.data

      if (!name.trim()) {
        wx.showToast({ title: '请输入规则名称', icon: 'none' })
        return
      }
      if (!selectedCategory) {
        wx.showToast({ title: '请选择类别', icon: 'none' })
        return
      }
      const amountNum = parseFloat(amountText)
      if (!amountText || isNaN(amountNum) || amountNum <= 0) {
        wx.showToast({ title: '请输入正确金额', icon: 'none' })
        return
      }

      const freq = FREQ_VALUES[freqIndex]

      // 统一重置为昨天，让 checkRecurringRules 能重新检查今天是否到期
      // alreadyExists 去重保证相同 ruleId+date 不会重复生成草稿
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yy = yesterday.getFullYear()
      const mm = String(yesterday.getMonth() + 1).padStart(2, '0')
      const dd = String(yesterday.getDate()).padStart(2, '0')
      const lastGeneratedDate = `${yy}-${mm}-${dd}`

      const rule: IRecurringRule = {
        id: isEdit ? ruleId : generateId(),
        name: name.trim(),
        type: RECORD_TYPES[typeIndex],
        category: selectedCategory,
        amount: yuanToFen(amountNum),
        note,
        frequency: freq,
        dayOfMonth: (freq === 'monthly' || freq === 'yearly') ? domIndex + 1 : undefined,
        dayOfWeek: freq === 'weekly' ? dowIndex : undefined,
        monthOfYear: freq === 'yearly' ? moyIndex + 1 : undefined,
        startDate,
        endDate: endDate || undefined,
        lastGeneratedDate,
        enabled: true,
      }

      if (isEdit) {
        updateRecurringRule(rule)
      } else {
        addRecurringRule(rule)
      }

      wx.navigateBack()
    },
  },
})
