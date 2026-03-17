import { CATEGORY_COLORS, CATEGORY_ICONS } from '../../models/record'
import { getBudgetAmount, getCategories, getRecords } from '../../utils/storage'

const now = new Date()
const PICKER_YEARS: string[] = Array.from({ length: 11 }, (_, i) => `${2020 + i}年`)
const PICKER_MONTHS: string[] = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

function formatCurrency(fen: number): string {
  const amount = fen / 100
  return amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function hexToRgba(color: string, alpha: number): string {
  const normalized = color.replace('#', '')
  const hex = normalized.length === 3
    ? normalized.split('').map((item) => item + item).join('')
    : normalized

  if (hex.length !== 6) return `rgba(255, 138, 0, ${alpha})`

  const red = parseInt(hex.slice(0, 2), 16)
  const green = parseInt(hex.slice(2, 4), 16)
  const blue = parseInt(hex.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

interface BudgetItem {
  category: string
  spentText: string
  budgetText: string
  percent: number
  progressWidth: number
  color: string
  accentColor: string
  iconText: string
  iconBg: string
  overBudget: boolean
}

Component({
  data: {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    pickerRange: [PICKER_YEARS, PICKER_MONTHS] as string[][],
    pickerValue: [now.getFullYear() - 2020, now.getMonth()] as number[],
    totalBudgetText: '0',
    expenseText: '0',
    remainText: '0',
    progress: 0,
    progressWidth: 0,
    daysLeft: 0,
    isOverBudget: false,
    remainLabel: '剩余',
    items: [] as BudgetItem[],
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
      const { year, month } = this.data
      const monthStr = `${year}-${String(month).padStart(2, '0')}`
      const records = getRecords().filter((item: any) => item.type === '支出' && item.date.startsWith(monthStr))
      const totalBudget = getBudgetAmount(year, month, '支出', '__total__')
      const categories = getCategories()['支出']
      let expense = 0
      records.forEach((item: any) => { expense += item.amount })

      const items = categories.map((category: string): BudgetItem | null => {
        const budget = getBudgetAmount(year, month, '支出', category)
        if (!budget) return null
        let spent = 0
        records.forEach((item: any) => {
          if (item.category === category) spent += item.amount
        })
        const percent = budget > 0 ? Math.round((spent / budget) * 100) : 0
        const color = CATEGORY_COLORS[category] || '#FF8A00'
        const overBudget = percent > 100
        return {
          category,
          spentText: formatCurrency(spent),
          budgetText: formatCurrency(budget),
          percent,
          progressWidth: Math.min(100, Math.max(0, percent)),
          color,
          accentColor: overBudget ? '#FA5151' : color,
          iconText: CATEGORY_ICONS[category] || category.slice(0, 1),
          iconBg: hexToRgba(color, 0.14),
          overBudget,
        }
      }).filter((item): item is BudgetItem => item !== null)
        .sort((a, b) => b.percent - a.percent)

      const lastDay = new Date(year, month, 0).getDate()
      const today = new Date().getDate()
      const progress = totalBudget > 0 ? Math.round((expense / totalBudget) * 100) : 0
      const remain = totalBudget - expense
      const isOverBudget = remain < 0

      this.setData({
        totalBudgetText: formatCurrency(totalBudget),
        expenseText: formatCurrency(expense),
        remainText: formatCurrency(Math.abs(remain)),
        progress,
        progressWidth: Math.min(100, Math.max(0, progress)),
        daysLeft: Math.max(0, lastDay - today),
        isOverBudget,
        remainLabel: isOverBudget ? '超出' : '剩余',
        items,
      })
    },

    onPickerChange(e: any) {
      const val = e.detail.value as [number, number]
      const year = 2020 + val[0]
      const month = val[1] + 1
      this.setData({ year, month, pickerValue: val })
      this.loadData()
    },

    onOpenBudgetSetting() {
      wx.navigateTo({ url: '/pages/budget-setting/budget-setting' })
    },
  },
})
