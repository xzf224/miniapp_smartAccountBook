import { getRecords, addRecord, updateRecord, getCategories } from '../../utils/storage'
import { IRecord, RecordType, RECORD_TYPES, generateId, yuanToFen } from '../../models/record'
import { getToday } from '../../utils/date'

Component({
  data: {
    isEdit: false,
    recordId: '',
    typeIndex: 0,
    types: RECORD_TYPES,
    categories: [] as string[],
    selectedCategory: '',
    amountText: '',
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
      this._loadFromOptions()
      this.loadCategories()
    },
  },

  methods: {
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
      const type = RECORD_TYPES[this.data.typeIndex]
      this.setData({ categories: cats[type] || [] })
    },

    loadRecord(id: string) {
      const records = getRecords()
      const record = records.find((r: IRecord) => r.id === id)
      if (!record) return
      const typeIndex = RECORD_TYPES.indexOf(record.type as RecordType)
      this.setData({
        isEdit: true,
        recordId: id,
        typeIndex: typeIndex >= 0 ? typeIndex : 0,
        selectedCategory: record.category,
        amountText: (record.amount / 100).toString(),
        date: record.date,
        note: record.note,
      })
      this.loadCategories()
    },

    onTypeChange(e: WechatMiniprogram.TouchEvent) {
      const idx = (e.currentTarget.dataset as any).index as number
      this.setData({ typeIndex: idx, selectedCategory: '' })
      this.loadCategories()
    },

    onCategorySelect(e: any) {
      this.setData({ selectedCategory: e.detail.category })
    },

    onAmountInput(e: WechatMiniprogram.Input) {
      this.setData({ amountText: e.detail.value })
    },

    onDateChange(e: any) {
      this.setData({ date: e.detail.value })
    },

    onNoteInput(e: WechatMiniprogram.Input) {
      this.setData({ note: e.detail.value })
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
      const type = RECORD_TYPES[typeIndex]
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
        createTime: existing ? existing.createTime : now,
        updateTime: now,
      }
      if (isEdit) {
        updateRecord(record)
        wx.showToast({ title: '已更新' })
      } else {
        addRecord(record)
        wx.showToast({ title: '已保存' })
      }
      setTimeout(() => wx.navigateBack(), 500)
    },
  },
})
