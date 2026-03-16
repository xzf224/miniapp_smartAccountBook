import { addRecord, getCategories } from '../../utils/storage'
import { generateId, yuanToFen } from '../../models/record'
import { getToday } from '../../utils/date'

Component({
  data: {
    typeIndex: 0,
    types: ['支出', '收入'],
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

  methods: {
    loadCategories() {
      const cats = getCategories()
      const type = this.data.types[this.data.typeIndex] as '支出' | '收入'
      this.setData({ categories: cats[type] || [] })
    },

    onTypeChange(e: any) {
      const idx = Number((e.currentTarget.dataset || {}).index)
      this.setData({ typeIndex: idx, selectedCategory: '' })
      this.loadCategories()
    },

    onCategorySelect(e: any) {
      this.setData({ selectedCategory: e.detail.category })
    },

    onAmountInput(e: any) {
      this.setData({ amountText: e.detail.value })
    },

    onDateChange(e: any) {
      this.setData({ date: e.detail.value })
    },

    onNoteInput(e: any) {
      this.setData({ note: e.detail.value })
    },

    onSave() {
      const { selectedCategory, amountText, date, note, typeIndex } = this.data
      const amount = parseFloat(amountText)
      if (!selectedCategory) {
        wx.showToast({ title: '请选择分类', icon: 'none' })
        return
      }
      if (!amountText || isNaN(amount) || amount <= 0) {
        wx.showToast({ title: '请输入正确金额', icon: 'none' })
        return
      }
      const now = Date.now()
      addRecord({
        id: generateId(),
        type: this.data.types[typeIndex] as any,
        category: selectedCategory,
        amount: yuanToFen(amount),
        date,
        note,
        createTime: now,
        updateTime: now,
      })
      wx.showToast({ title: '已保存', icon: 'success' })
      this.setData({
        selectedCategory: '',
        amountText: '',
        date: getToday(),
        note: '',
      })
      setTimeout(() => wx.switchTab({ url: '/pages/home/home' }), 400)
    },
  },
})
