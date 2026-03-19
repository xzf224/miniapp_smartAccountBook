import { getCategories, getBudgets, upsertBudget, deleteBudget, getRecords, getCurrencyCode, getCurrencySymbol, getReminderSettings, saveReminderSettings } from '../../utils/storage'
import { hexToRgba } from '../../utils/format'
import { fenToYuan, yuanToFen, CATEGORY_COLORS, CATEGORY_ICONS } from '../../models/record'

type StatusTone = 'normal' | 'warning' | 'danger' | 'neutral'

interface CatBudgetItem {
  rank: number
  category: string
  budgetFen: number
  budgetYuan: string
  spentFen: number
  spentYuan: string
  progressPct: number
  spentPct: number
  isOver: boolean
  iconText: string
  iconColor: string
  iconBgRgba: string
  editingBudget: boolean
  editBudgetValue: string
  isPriority: boolean
  statusText: string
  statusTone: StatusTone
  cardBg: string
  accentColor: string
}

const EXPENSE_TYPE = '支出' as const
const ALLOCATION_WARNING_THRESHOLD = 90

function getCatStatusTone(spentPct: number): StatusTone {
  if (spentPct > 100) return 'danger'
  if (spentPct >= 85) return 'warning'
  return 'normal'
}

function getCatStatusText(spentPct: number, isPriority: boolean): string {
  if (spentPct > 100) return '已超支'
  if (spentPct >= 85) return '接近上限'
  if (isPriority) return '优先检查'
  return '预算稳定'
}

function buildOverview(totalBudgetFen: number, totalCatBudgetFen: number) {
  if (totalBudgetFen <= 0) {
    if (totalCatBudgetFen > 0) {
      return {
        overviewStatusText: '未设总额',
        overviewStatusTone: 'neutral' as StatusTone,
        overviewHintText: '当前只设置了分类预算，您也可以继续保持不设总预算。',
      }
    }

    return {
      overviewStatusText: '待设置',
      overviewStatusTone: 'neutral' as StatusTone,
      overviewHintText: '总预算和分类预算都可以独立设置，当前两者都未设置。',
    }
  }

  if (totalCatBudgetFen <= 0) {
    return {
      overviewStatusText: '待分配',
      overviewStatusTone: 'warning' as StatusTone,
      overviewHintText: '总预算已设置，但分类预算还未开始分配。',
    }
  }

  if (totalCatBudgetFen > totalBudgetFen) {
    return {
      overviewStatusText: '超出总额',
      overviewStatusTone: 'danger' as StatusTone,
      overviewHintText: '分类预算合计已经超过总预算，建议立即调整。',
    }
  }

  const allocatedPct = Math.round((totalCatBudgetFen / totalBudgetFen) * 100)
  if (allocatedPct >= ALLOCATION_WARNING_THRESHOLD) {
    return {
      overviewStatusText: '分配偏满',
      overviewStatusTone: 'warning' as StatusTone,
      overviewHintText: `已分配 ${allocatedPct}% 的总预算，新增分类前建议预留空间。`,
    }
  }

  return {
    overviewStatusText: '分配合理',
    overviewStatusTone: 'normal' as StatusTone,
    overviewHintText: `已分配 ${allocatedPct}% 的总预算，当前结构相对健康。`,
  }
}

function decorateCatBudgets(items: CatBudgetItem[]): CatBudgetItem[] {
  return items
    .slice()
    .sort((a, b) => b.spentPct - a.spentPct || b.budgetFen - a.budgetFen)
    .map((item, index) => {
      const isPriority = index < 3
      const statusTone = getCatStatusTone(item.spentPct)
      const accentColor = statusTone === 'danger' ? '#FA5151' : statusTone === 'warning' ? '#D97706' : item.iconColor
      return {
        ...item,
        rank: index + 1,
        isPriority,
        statusTone,
        statusText: getCatStatusText(item.spentPct, isPriority),
        cardBg: statusTone === 'danger'
          ? 'rgba(250, 81, 81, 0.06)'
          : isPriority
            ? hexToRgba(item.iconColor, 0.08)
            : '#F8F8F8',
        accentColor,
      }
    })
}

function buildCatBudgetItem(category: string, budgetFen: number, spentFen: number): CatBudgetItem {
  const spentPct = budgetFen > 0 ? Math.round((spentFen / budgetFen) * 100) : 0
  const iconColor = CATEGORY_COLORS[category] || '#95A5A6'
  return {
    rank: 0,
    category,
    budgetFen,
    budgetYuan: fenToYuan(budgetFen),
    spentFen,
    spentYuan: fenToYuan(spentFen),
    progressPct: Math.min(spentPct, 100),
    spentPct,
    isOver: spentPct > 100,
    iconText: CATEGORY_ICONS[category] || category.slice(0, 1),
    iconColor,
    iconBgRgba: hexToRgba(iconColor, 0.15),
    editingBudget: false,
    editBudgetValue: '',
    isPriority: false,
    statusText: '',
    statusTone: 'normal',
    cardBg: '#F8F8F8',
    accentColor: iconColor,
  }
}

function getAvailableCategories(allExpenseCategories: string[], catBudgets: CatBudgetItem[]) {
  const budgetedCats = new Set(catBudgets.map(item => item.category))
  return allExpenseCategories.filter(category => !budgetedCats.has(category))
}

function buildDraftState(
  totalBudgetFen: number,
  catBudgets: CatBudgetItem[],
  allExpenseCategories: string[],
) {
  const decorated = decorateCatBudgets(catBudgets)
  const totalCatBudgetFen = decorated.reduce((sum, item) => sum + item.budgetFen, 0)
  const unallocatedFen = totalBudgetFen - totalCatBudgetFen

  return {
    catBudgets: decorated,
    availableCategories: getAvailableCategories(allExpenseCategories, decorated),
    totalCatBudgetFen,
    totalCatBudgetDisplay: fenToYuan(totalCatBudgetFen),
    unallocatedFen,
    unallocatedDisplay: fenToYuan(Math.abs(unallocatedFen)),
    unallocatedPositive: unallocatedFen >= 0,
    ...buildOverview(totalBudgetFen, totalCatBudgetFen),
  }
}

Component({
  data: {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,

    totalBudgetFen: 0,
    totalBudgetDisplay: '0.00',
    editingTotal: false,
    editTotalValue: '',

    alertThreshold: 80,
    alertEnabled: false,
    editingThreshold: false,
    editThresholdValue: '',

    catBudgets: [] as CatBudgetItem[],
    allExpenseCategories: [] as string[],

    showAddForm: false,
    availableCategories: [] as string[],
    addPickerIndex: 0,
    addBudgetValue: '',

    totalCatBudgetFen: 0,
    totalCatBudgetDisplay: '0.00',
    unallocatedFen: 0,
    unallocatedDisplay: '0.00',
    unallocatedPositive: true,
    overviewStatusText: '待设置',
    overviewStatusTone: 'neutral' as StatusTone,
    overviewHintText: '',
    currencySymbol: '¥',
  },

  lifetimes: {
    attached() {
      this.setData({ currencySymbol: getCurrencySymbol() })
      this.loadData()
    },
  },

  pageLifetimes: {
    show() {
      this.setData({ currencySymbol: getCurrencySymbol() })
      this.loadData()
    },
  },

  methods: {
    getDraftState(overrides?: {
      totalBudgetFen?: number
      catBudgets?: CatBudgetItem[]
    }) {
      const totalBudgetFen = overrides?.totalBudgetFen ?? this.data.totalBudgetFen
      const catBudgets = overrides?.catBudgets ?? this.data.catBudgets

      return buildDraftState(
        totalBudgetFen,
        catBudgets,
        this.data.allExpenseCategories,
      )
    },

    loadData() {
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth() + 1

      const reminderSettings = getReminderSettings()
      const alertThreshold = reminderSettings.budgetAlertThreshold
      const alertEnabled = reminderSettings.budgetAlertEnabled

      const budgets = getBudgets()
      const records = getRecords()
      const allExpenseCategories = getCategories()[EXPENSE_TYPE] || []

      const totalEntry = budgets.find(
        budget => budget.year === year
          && budget.month === month
          && budget.type === EXPENSE_TYPE
          && budget.category === '__total__',
      )
      const totalBudgetFen = totalEntry ? totalEntry.amount : 0

      const prefix = `${year}-${String(month).padStart(2, '0')}`
      const currentCurrencyCode = getCurrencyCode()
      const monthRecords = records.filter(
        record => record.type === EXPENSE_TYPE
          && record.date.startsWith(prefix)
          && (record.currency ?? 'CNY') === currentCurrencyCode,
      )
      const spentByCat: Record<string, number> = {}
      for (const record of monthRecords) {
        spentByCat[record.category] = (spentByCat[record.category] || 0) + record.amount
      }

      const catBudgets = budgets
        .filter(
          budget => budget.year === year
            && budget.month === month
            && budget.type === EXPENSE_TYPE
            && budget.category !== '__total__'
            && budget.amount > 0,
        )
        .map(budget => buildCatBudgetItem(
          budget.category,
          budget.amount,
          spentByCat[budget.category] || 0,
        ))

      this.setData({
        year,
        month,
        alertThreshold,
        alertEnabled,
        totalBudgetFen,
        totalBudgetDisplay: fenToYuan(totalBudgetFen),
        editingTotal: false,
        editTotalValue: '',
        editingThreshold: false,
        editThresholdValue: '',
        allExpenseCategories,
        showAddForm: false,
        addPickerIndex: 0,
        addBudgetValue: '',
        ...buildDraftState(totalBudgetFen, catBudgets, allExpenseCategories),
      })
    },

    onEditTotal() {
      this.setData({
        editingTotal: true,
        editTotalValue: this.data.totalBudgetFen > 0 ? fenToYuan(this.data.totalBudgetFen) : '',
      })
    },

    onClearTotal() {
      this.setData({
        editingTotal: false,
        editTotalValue: '',
        totalBudgetFen: 0,
        totalBudgetDisplay: '0.00',
        ...this.getDraftState({ totalBudgetFen: 0 }),
      })
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
        this.setData({ editingTotal: false, editTotalValue: '' })
        return
      }

      const totalBudgetFen = yuanToFen(val)
      if (totalBudgetFen < this.data.totalCatBudgetFen) {
        wx.showToast({
          title: `不能低于分类合计${this.data.currencySymbol}${fenToYuan(this.data.totalCatBudgetFen)}`,
          icon: 'none',
          duration: 2000,
        })
        this.setData({ editingTotal: false, editTotalValue: '' })
        return
      }

      this.setData({
        editingTotal: false,
        editTotalValue: '',
        totalBudgetFen,
        totalBudgetDisplay: fenToYuan(totalBudgetFen),
        ...this.getDraftState({ totalBudgetFen }),
      })
    },

    onEditThreshold() {
      this.setData({
        editingThreshold: true,
        editThresholdValue: String(this.data.alertThreshold),
      })
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
      const val = parseInt(raw, 10)

      if (!raw || isNaN(val) || val < 1 || val > 100) {
        this.setData({ editingThreshold: false, editThresholdValue: '' })
        return
      }

      this.setData({
        editingThreshold: false,
        editThresholdValue: '',
        alertThreshold: val,
      })
    },

    onAlertToggle(e: WechatMiniprogram.CustomEvent) {
      this.setData({ alertEnabled: e.detail.value })
    },

    onEditCatBudget(e: WechatMiniprogram.CustomEvent) {
      const index = Number(e.currentTarget.dataset.index)
      const catBudgets = this.data.catBudgets.map((item, itemIndex) => ({
        ...item,
        editingBudget: itemIndex === index,
        editBudgetValue: itemIndex === index ? fenToYuan(item.budgetFen) : '',
      }))
      this.setData({ catBudgets })
    },

    onCatBudgetInput(e: WechatMiniprogram.CustomEvent) {
      const index = Number(e.currentTarget.dataset.index)
      const catBudgets = this.data.catBudgets.slice()
      catBudgets[index] = {
        ...catBudgets[index],
        editBudgetValue: e.detail.value,
      }
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
        catBudgets[index] = { ...item, editingBudget: false, editBudgetValue: '' }
        this.setData({ catBudgets })
        return
      }

      catBudgets[index] = {
        ...item,
        budgetFen: yuanToFen(val),
        budgetYuan: fenToYuan(yuanToFen(val)),
        editingBudget: false,
        editBudgetValue: '',
      }

      this.setData({
        ...this.getDraftState({ catBudgets }),
      })
    },

    onDeleteCatBudget(e: WechatMiniprogram.CustomEvent) {
      const index = Number(e.currentTarget.dataset.index)
      const catBudgets = this.data.catBudgets.filter((_: CatBudgetItem, itemIndex: number) => itemIndex !== index)

      this.setData({
        addPickerIndex: 0,
        ...this.getDraftState({ catBudgets }),
      })
    },

    onToggleAddForm() {
      if (this.data.availableCategories.length === 0) {
        wx.showToast({ title: '所有分类均已设置预算', icon: 'none' })
        return
      }

      this.setData({
        showAddForm: !this.data.showAddForm,
        addBudgetValue: '',
        addPickerIndex: 0,
      })
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
        wx.showToast({ title: '请选择分类', icon: 'none' })
        return
      }

      if (!addBudgetValue.trim() || isNaN(val) || val <= 0) {
        wx.showToast({ title: '请输入有效金额', icon: 'none' })
        return
      }

      const catBudgets = [
        ...this.data.catBudgets,
        buildCatBudgetItem(category, yuanToFen(val), 0),
      ]

      this.setData({
        showAddForm: false,
        addBudgetValue: '',
        addPickerIndex: 0,
        ...this.getDraftState({ catBudgets }),
      })
    },

    onCancelAdd() {
      this.setData({
        showAddForm: false,
        addBudgetValue: '',
        addPickerIndex: 0,
      })
    },

    onSave() {
      const { year, month, totalBudgetFen, catBudgets, alertThreshold, alertEnabled } = this.data

      if (totalBudgetFen > 0) {
        upsertBudget({ year, month, type: EXPENSE_TYPE, category: '__total__', amount: totalBudgetFen })
      } else {
        deleteBudget(year, month, EXPENSE_TYPE, '__total__')
      }

      const existing = getBudgets().filter(
        budget => budget.type === EXPENSE_TYPE
          && budget.year === year
          && budget.month === month
          && budget.category !== '__total__',
      )
      for (const budget of existing) {
        deleteBudget(year, month, EXPENSE_TYPE, budget.category)
      }
      for (const item of catBudgets) {
        if (item.budgetFen > 0) {
          upsertBudget({
            year,
            month,
            type: EXPENSE_TYPE,
            category: item.category,
            amount: item.budgetFen,
          })
        }
      }

      saveReminderSettings({
        budgetAlertThreshold: alertThreshold,
        budgetAlertEnabled: alertEnabled,
      })

      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => {
        wx.navigateBack()
      }, 800)
    },
  },
})
