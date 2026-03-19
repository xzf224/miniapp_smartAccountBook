import {
  getRecurringRules,
  addRecurringRule,
  updateRecurringRule,
  getCategories,
  getCurrencyCode,
} from '../../utils/storage'
import { IRecurringRule, RecordType, RECORD_TYPES, generateId, yuanToFen } from '../../models/record'
import { getToday } from '../../utils/date'

const FREQ_OPTIONS = ['每天', '每周', '每月', '每年']
const FREQ_VALUES: IRecurringRule['frequency'][] = ['daily', 'weekly', 'monthly', 'yearly']
const RECURRING_TYPES: RecordType[] = RECORD_TYPES.filter((type): type is Extract<RecordType, '支出' | '收入'> => type !== '不计入收支')
const DOW_OPTIONS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => `${i + 1}月`)
const DOM_OPTIONS = Array.from({ length: 31 }, (_, i) => `${i + 1}日`)

Component({
  data: {
    isEdit: false,
    ruleId: '',
    name: '',
    typeIndex: 0,
    types: RECURRING_TYPES,
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
    scheduleSummaryText: '',
    dateRangeSummaryText: '',
    amountPreviewText: '',
    categoryPreviewText: '未选择类别',
    saveButtonText: '保存规则',
  },

  lifetimes: {
    attached() {
      this.setData({ startDate: getToday() }, () => this._updateViewState())
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
      const type = RECURRING_TYPES[this.data.typeIndex]
      this.setData({ categories: cats[type] || [] }, () => this._updateViewState())
    },

    _updateViewState() {
      const {
        isEdit,
        freqIndex,
        dowIndex,
        domIndex,
        moyIndex,
        startDate,
        endDate,
        amountText,
        selectedCategory,
      } = this.data
      const frequency = FREQ_VALUES[freqIndex]
      const scheduleSummaryText = frequency === 'daily'
        ? '每天执行'
        : frequency === 'weekly'
          ? `每周 ${DOW_OPTIONS[dowIndex]}`
          : frequency === 'monthly'
            ? `每月 ${DOM_OPTIONS[domIndex]}`
            : `每年 ${MONTH_OPTIONS[moyIndex]} ${DOM_OPTIONS[domIndex]}`
      const dateRangeSummaryText = endDate
        ? `${startDate} 至 ${endDate}`
        : `${startDate} 起长期有效`
      const amountPreviewText = amountText ? `¥${amountText}` : '待填写金额'
      const categoryPreviewText = selectedCategory || '未选择类别'
      const saveButtonText = isEdit ? '保存修改' : '创建规则'

      this.setData({
        scheduleSummaryText,
        dateRangeSummaryText,
        amountPreviewText,
        categoryPreviewText,
        saveButtonText,
      })
    },

    loadRule(id: string) {
      const rules = getRecurringRules()
      const rule = rules.find(r => r.id === id)
      if (!rule) return
      const safeType = RECURRING_TYPES.includes(rule.type as Extract<RecordType, '支出' | '收入'>)
        ? rule.type as Extract<RecordType, '支出' | '收入'>
        : '支出'
      const typeIndex = RECURRING_TYPES.indexOf(safeType)
      const freqIndex = FREQ_VALUES.indexOf(rule.frequency)
      const cats = getCategories()
      this.setData({
        isEdit: true,
        ruleId: id,
        name: rule.name,
        typeIndex: typeIndex >= 0 ? typeIndex : 0,
        categories: cats[safeType] || [],
        selectedCategory: safeType === rule.type ? rule.category : '',
        amountText: (rule.amount / 100).toString(),
        note: rule.note,
        freqIndex: freqIndex >= 0 ? freqIndex : 2,
        dowIndex: rule.dayOfWeek ?? 1,
        domIndex: (rule.dayOfMonth ?? 1) - 1,
        moyIndex: (rule.monthOfYear ?? 1) - 1,
        startDate: rule.startDate,
        endDate: rule.endDate || '',
      }, () => this._updateViewState())
    },

    onNameInput(e: WechatMiniprogram.Input) {
      this.setData({ name: e.detail.value })
    },

    onTypeChange(e: WechatMiniprogram.TouchEvent) {
      const idx = (e.currentTarget.dataset as any).index as number
      this.setData({ typeIndex: idx, selectedCategory: '' }, () => this._updateViewState())
      this._loadCategories()
    },

    onCategorySelect(e: any) {
      this.setData({ selectedCategory: e.detail.category }, () => this._updateViewState())
    },

    onAmountInput(e: WechatMiniprogram.Input) {
      this.setData({ amountText: e.detail.value }, () => this._updateViewState())
    },

    onNoteInput(e: WechatMiniprogram.Input) {
      this.setData({ note: e.detail.value })
    },

    onFreqChange(e: WechatMiniprogram.PickerChange) {
      this.setData({ freqIndex: Number(e.detail.value) }, () => this._updateViewState())
    },

    onDowChange(e: WechatMiniprogram.PickerChange) {
      this.setData({ dowIndex: Number(e.detail.value) }, () => this._updateViewState())
    },

    onDomChange(e: WechatMiniprogram.PickerChange) {
      this.setData({ domIndex: Number(e.detail.value) }, () => this._updateViewState())
    },

    onMoyChange(e: WechatMiniprogram.PickerChange) {
      this.setData({ moyIndex: Number(e.detail.value) }, () => this._updateViewState())
    },

    onStartDateChange(e: WechatMiniprogram.PickerChange) {
      this.setData({ startDate: e.detail.value as string }, () => this._updateViewState())
    },

    onEndDateChange(e: WechatMiniprogram.PickerChange) {
      this.setData({ endDate: e.detail.value as string }, () => this._updateViewState())
    },

    onClearEndDate() {
      this.setData({ endDate: '' }, () => this._updateViewState())
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
        type: RECURRING_TYPES[typeIndex],
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
        currency: getCurrencyCode(),
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
