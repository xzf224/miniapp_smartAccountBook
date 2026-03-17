import { getCategories, getBudgets, upsertBudget, deleteBudget, getRecords } from '../../utils/storage'
import { IBudget, fenToYuan, yuanToFen, CATEGORY_COLORS, CATEGORY_ICONS } from '../../models/record'

interface CatBudgetItem {
  category: string
  budgetFen: number
  budgetYuan: string        // display text e.g. "1,000.00"
  spentFen: number
  spentYuan: string         // display text
  progressPct: number       // 0-100, capped at 100
  spentPct: number          // actual percent (may exceed 100)
  isOver: boolean
  iconText: string
  iconColor: string         // hex
  iconBgRgba: string        // rgba string for 15% opacity background
  editingBudget: boolean
  editBudgetValue: string   // raw input value while editing
}

Component({
  data: {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,

    // --- Total budget ---
    totalBudgetFen: 0,
    totalBudgetDisplay: '0.00',
    editingTotal: false,
    editTotalValue: '',

    // --- Alert settings ---
    alertThreshold: 80,
    alertEnabled: false,
    editingThreshold: false,
    editThresholdValue: '',

    // --- Category budgets (only those with amount > 0) ---
    catBudgets: [] as CatBudgetItem[],

    // --- Add category form ---
    showAddForm: false,
    availableCategories: [] as string[],   // categories without a budget yet
    addPickerIndex: 0,
    addBudgetValue: '',

    // --- Summary ---
    totalCatBudgetFen: 0,
    totalCatBudgetDisplay: '0.00',
    unallocatedFen: 0,
    unallocatedDisplay: '0.00',
    unallocatedPositive: true,
  },

  lifetimes: {
    attached() {
      this.loadData()
    }
  },

  pageLifetimes: {
    show() {
      this.loadData()
    }
  },

  methods: {
    loadData() {
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth() + 1
      const type = '支出' as const

      // Load alert settings
      const alertThreshold = wx.getStorageSync('budgetAlertThreshold') || 80
      const alertEnabled = wx.getStorageSync('budgetAlertEnabled') || false

      // Load all budgets and records
      const budgets = getBudgets()
      const records = getRecords()

      // Total budget — try exact month first, then universal (month=0)
      const totalEntry = budgets.find(
        b => b.year === year && b.month === month && b.type === type && b.category === '__total__'
      ) || budgets.find(
        b => b.month === 0 && b.type === type && b.category === '__total__'
      )
      const totalBudgetFen = totalEntry ? totalEntry.amount : 0
      const totalBudgetDisplay = fenToYuan(totalBudgetFen)

      // Category budgets — only entries with amount > 0 for this month
      const allCats = getCategories()['支出'] || []

      // Compute spent per category this month
      const prefix = `${year}-${String(month).padStart(2, '0')}`
      const monthRecords = records.filter(
        r => r.type === type && r.date.startsWith(prefix)
      )
      const spentByCat: Record<string, number> = {}
      for (const r of monthRecords) {
        spentByCat[r.category] = (spentByCat[r.category] || 0) + r.amount
      }

      // Build catBudgets list from budget entries that have amount > 0
      const catBudgetEntries = budgets.filter(
        b => b.type === type && b.category !== '__total__' && b.amount > 0 &&
          ((b.year === year && b.month === month) || b.month === 0)
      )
      // deduplicate: prefer month-specific over universal
      const seen = new Set<string>()
      const dedupedEntries: IBudget[] = []
      for (const b of catBudgetEntries) {
        if (b.year === year && b.month === month) {
          seen.add(b.category)
          dedupedEntries.push(b)
        }
      }
      for (const b of catBudgetEntries) {
        if (b.month === 0 && !seen.has(b.category)) {
          seen.add(b.category)
          dedupedEntries.push(b)
        }
      }

      const catBudgets: CatBudgetItem[] = dedupedEntries.map(b => {
        const spentFen = spentByCat[b.category] || 0
        const pct = b.amount > 0 ? Math.round((spentFen / b.amount) * 100) : 0
        const color = CATEGORY_COLORS[b.category] || '#95A5A6'
        const hex = color.replace('#', '')
        const r = parseInt(hex.slice(0, 2), 16)
        const g = parseInt(hex.slice(2, 4), 16)
        const bl = parseInt(hex.slice(4, 6), 16)
        return {
          category: b.category,
          budgetFen: b.amount,
          budgetYuan: fenToYuan(b.amount),
          spentFen,
          spentYuan: fenToYuan(spentFen),
          progressPct: Math.min(pct, 100),
          spentPct: pct,
          isOver: pct > 100,
          iconText: CATEGORY_ICONS[b.category] || b.category.slice(0, 1),
          iconColor: color,
          iconBgRgba: `rgba(${r},${g},${bl},0.15)`,
          editingBudget: false,
          editBudgetValue: '',
        }
      })

      // Summary
      const totalCatBudgetFen = catBudgets.reduce((s, c) => s + c.budgetFen, 0)
      const unallocatedFen = totalBudgetFen - totalCatBudgetFen
      const unallocatedPositive = unallocatedFen >= 0

      // Available categories for add form (those not yet in catBudgets)
      const budgetedCats = new Set(catBudgets.map(c => c.category))
      const availableCategories = allCats.filter(c => !budgetedCats.has(c))

      this.setData({
        year, month,
        alertThreshold, alertEnabled,
        totalBudgetFen, totalBudgetDisplay,
        catBudgets,
        totalCatBudgetFen,
        totalCatBudgetDisplay: fenToYuan(totalCatBudgetFen),
        unallocatedFen,
        unallocatedDisplay: fenToYuan(Math.abs(unallocatedFen)),
        unallocatedPositive,
        availableCategories,
        addPickerIndex: 0,
        addBudgetValue: '',
        showAddForm: false,
      })
    },

    // ---- Total budget inline edit ----
    onEditTotal() {
      this.setData({ editingTotal: true, editTotalValue: fenToYuan(this.data.totalBudgetFen) })
    },

    onTotalInput(e: WechatMiniprogram.CustomEvent) {
      this.setData({ editTotalValue: e.detail.value })
    },

    onTotalBlur() {
      this._confirmTotal()
    },

    onTotalConfirm() {
      this._confirmTotal()
    },

    _confirmTotal() {
      const raw = this.data.editTotalValue.trim()
      const val = parseFloat(raw)
      if (!raw || isNaN(val) || val < 0) {
        this.setData({ editingTotal: false })
        return
      }
      const totalBudgetFen = yuanToFen(val)
      const totalBudgetDisplay = fenToYuan(totalBudgetFen)
      const unallocatedFen = totalBudgetFen - this.data.totalCatBudgetFen
      this.setData({
        editingTotal: false,
        totalBudgetFen,
        totalBudgetDisplay,
        unallocatedFen,
        unallocatedDisplay: fenToYuan(Math.abs(unallocatedFen)),
        unallocatedPositive: unallocatedFen >= 0,
      })
    },

    // ---- Alert threshold inline edit ----
    onEditThreshold() {
      this.setData({ editingThreshold: true, editThresholdValue: String(this.data.alertThreshold) })
    },

    onThresholdInput(e: WechatMiniprogram.CustomEvent) {
      this.setData({ editThresholdValue: e.detail.value })
    },

    onThresholdBlur() {
      this._confirmThreshold()
    },

    onThresholdConfirm() {
      this._confirmThreshold()
    },

    _confirmThreshold() {
      const raw = this.data.editThresholdValue.trim()
      const val = parseInt(raw)
      if (!raw || isNaN(val) || val < 1 || val > 100) {
        this.setData({ editingThreshold: false })
        return
      }
      this.setData({ editingThreshold: false, alertThreshold: val })
    },

    onAlertToggle(e: WechatMiniprogram.CustomEvent) {
      this.setData({ alertEnabled: e.detail.value })
    },

    // ---- Category budget inline edit ----
    onEditCatBudget(e: WechatMiniprogram.CustomEvent) {
      const index = Number(e.currentTarget.dataset.index)
      const catBudgets = this.data.catBudgets.map((item, i) => ({
        ...item,
        editingBudget: i === index,
        editBudgetValue: i === index ? fenToYuan(item.budgetFen) : item.editBudgetValue,
      }))
      this.setData({ catBudgets })
    },

    onCatBudgetInput(e: WechatMiniprogram.CustomEvent) {
      const index = Number(e.currentTarget.dataset.index)
      const catBudgets = this.data.catBudgets.slice()
      catBudgets[index] = { ...catBudgets[index], editBudgetValue: e.detail.value }
      this.setData({ catBudgets })
    },

    onCatBudgetBlur(e: WechatMiniprogram.CustomEvent) {
      const index = Number(e.currentTarget.dataset.index)
      this._confirmCatBudget(index)
    },

    onCatBudgetConfirm(e: WechatMiniprogram.CustomEvent) {
      const index = Number(e.currentTarget.dataset.index)
      this._confirmCatBudget(index)
    },

    _confirmCatBudget(index: number) {
      const catBudgets = this.data.catBudgets.slice()
      const item = catBudgets[index]
      const raw = item.editBudgetValue.trim()
      const val = parseFloat(raw)
      if (!raw || isNaN(val) || val <= 0) {
        catBudgets[index] = { ...item, editingBudget: false }
        this.setData({ catBudgets })
        return
      }
      const budgetFen = yuanToFen(val)
      catBudgets[index] = {
        ...item,
        budgetFen,
        budgetYuan: fenToYuan(budgetFen),
        editingBudget: false,
      }
      const totalCatBudgetFen = catBudgets.reduce((s, c) => s + c.budgetFen, 0)
      const unallocatedFen = this.data.totalBudgetFen - totalCatBudgetFen
      this.setData({
        catBudgets,
        totalCatBudgetFen,
        totalCatBudgetDisplay: fenToYuan(totalCatBudgetFen),
        unallocatedFen,
        unallocatedDisplay: fenToYuan(Math.abs(unallocatedFen)),
        unallocatedPositive: unallocatedFen >= 0,
      })
    },

    // ---- Delete category budget ----
    onDeleteCatBudget(e: WechatMiniprogram.CustomEvent) {
      const index = Number(e.currentTarget.dataset.index)
      const catBudgets = this.data.catBudgets.slice()
      const removed = catBudgets.splice(index, 1)[0]

      const totalCatBudgetFen = catBudgets.reduce((s, c) => s + c.budgetFen, 0)
      const unallocatedFen = this.data.totalBudgetFen - totalCatBudgetFen

      // Add removed category back to available list
      const availableCategories = [...this.data.availableCategories, removed.category]

      this.setData({
        catBudgets,
        totalCatBudgetFen,
        totalCatBudgetDisplay: fenToYuan(totalCatBudgetFen),
        unallocatedFen,
        unallocatedDisplay: fenToYuan(Math.abs(unallocatedFen)),
        unallocatedPositive: unallocatedFen >= 0,
        availableCategories,
        addPickerIndex: 0,
      })
    },

    // ---- Add category budget form ----
    onToggleAddForm() {
      if (this.data.availableCategories.length === 0) {
        wx.showToast({ title: '所有分类均已设置预算', icon: 'none' })
        return
      }
      this.setData({ showAddForm: !this.data.showAddForm, addBudgetValue: '', addPickerIndex: 0 })
    },

    onAddPickerChange(e: WechatMiniprogram.CustomEvent) {
      this.setData({ addPickerIndex: Number(e.detail.value) })
    },

    onAddBudgetInput(e: WechatMiniprogram.CustomEvent) {
      this.setData({ addBudgetValue: e.detail.value })
    },

    onConfirmAdd() {
      const { availableCategories, addPickerIndex, addBudgetValue } = this.data
      const category = availableCategories[addPickerIndex]
      const val = parseFloat(addBudgetValue.trim())
      if (!category) {
        wx.showToast({ title: '请选择分类', icon: 'none' }); return
      }
      if (!addBudgetValue.trim() || isNaN(val) || val <= 0) {
        wx.showToast({ title: '请输入有效金额', icon: 'none' }); return
      }

      const budgetFen = yuanToFen(val)
      const color = CATEGORY_COLORS[category] || '#95A5A6'
      const hex = color.replace('#', '')
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const bl = parseInt(hex.slice(4, 6), 16)

      const spentFen = 0  // new entry, no spend yet accounted (recalculated on reload)
      const newItem: CatBudgetItem = {
        category,
        budgetFen,
        budgetYuan: fenToYuan(budgetFen),
        spentFen,
        spentYuan: fenToYuan(0),
        progressPct: 0,
        spentPct: 0,
        isOver: false,
        iconText: CATEGORY_ICONS[category] || category.slice(0, 1),
        iconColor: color,
        iconBgRgba: `rgba(${r},${g},${bl},0.15)`,
        editingBudget: false,
        editBudgetValue: '',
      }

      const catBudgets = [...this.data.catBudgets, newItem]
      const newAvailable = availableCategories.filter(c => c !== category)
      const totalCatBudgetFen = catBudgets.reduce((s, c) => s + c.budgetFen, 0)
      const unallocatedFen = this.data.totalBudgetFen - totalCatBudgetFen

      this.setData({
        catBudgets,
        availableCategories: newAvailable,
        showAddForm: false,
        addBudgetValue: '',
        addPickerIndex: 0,
        totalCatBudgetFen,
        totalCatBudgetDisplay: fenToYuan(totalCatBudgetFen),
        unallocatedFen,
        unallocatedDisplay: fenToYuan(Math.abs(unallocatedFen)),
        unallocatedPositive: unallocatedFen >= 0,
      })
    },

    onCancelAdd() {
      this.setData({ showAddForm: false, addBudgetValue: '' })
    },

    // ---- Save all ----
    onSave() {
      const { year, month, totalBudgetFen, catBudgets, alertThreshold, alertEnabled } = this.data
      const type = '支出' as const

      // Save total budget
      if (totalBudgetFen > 0) {
        upsertBudget({ year, month, type, category: '__total__', amount: totalBudgetFen })
      } else {
        deleteBudget(year, month, type, '__total__')
      }

      // Save category budgets — first clear existing month entries to handle deletions
      const existing = getBudgets().filter(
        b => b.type === type && b.year === year && b.month === month && b.category !== '__total__'
      )
      for (const b of existing) {
        deleteBudget(year, month, type, b.category)
      }
      for (const item of catBudgets) {
        if (item.budgetFen > 0) {
          upsertBudget({ year, month, type, category: item.category, amount: item.budgetFen })
        }
      }

      // Save alert settings
      wx.setStorageSync('budgetAlertThreshold', alertThreshold)
      wx.setStorageSync('budgetAlertEnabled', alertEnabled)

      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => {
        wx.navigateBack()
      }, 800)
    },
  }
})
