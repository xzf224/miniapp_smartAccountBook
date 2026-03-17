import { CATEGORY_COLORS, CATEGORY_ICONS } from '../../models/record'
import { getBudgetAmount, getCategories, getRecords, getCurrencyCode } from '../../utils/storage'

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
  rank: number
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
  isPriority: boolean
  cardBg: string
  statusText: string
  statusTone: 'normal' | 'warning' | 'danger'
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
    summaryValueText: '0',
    summaryLabel: '剩余可用',
    budgetStatusText: '预算稳定',
    budgetHintText: '',
    budgetStatusTone: 'normal',
    progress: 0,
    progressWidth: 0,
    daysLeft: 0,
    daysLeftText: '剩余0天',
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
      const currentCurrencyCode = getCurrencyCode()
      const records = getRecords().filter((item: any) => item.type === '支出' && item.date.startsWith(monthStr) && (item.currency ?? 'CNY') === currentCurrencyCode)
      const totalBudget = getBudgetAmount(year, month, '支出', '__total__')
      const categories = getCategories()['支出']
      let expense = 0
      records.forEach((item: any) => { expense += item.amount })

      const sortedItems = categories.map((category: string): BudgetItem | null => {
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
          rank: 0,
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
          isPriority: false,
          cardBg: '#FFFFFF',
          statusText: '',
          statusTone: 'normal',
        }
      }).filter((item): item is BudgetItem => item !== null)
        .sort((a, b) => b.percent - a.percent)

      const items = sortedItems.map((item, index) => {
        const isPriority = index < 3
        const statusTone: BudgetItem['statusTone'] = item.overBudget
          ? 'danger'
          : item.percent >= 90
            ? 'warning'
            : 'normal'
        return {
          ...item,
          rank: index + 1,
          isPriority,
          statusTone,
          cardBg: item.overBudget
            ? 'rgba(250, 81, 81, 0.08)'
            : isPriority
              ? hexToRgba(item.color, 0.08)
              : '#FFFFFF',
          statusText: item.overBudget
            ? '已超支'
            : item.percent >= 90
              ? '接近上限'
              : isPriority
                ? '优先关注'
                : '预算稳定',
        }
      })

      const lastDay = new Date(year, month, 0).getDate()
      const today = new Date()
      const currentYear = today.getFullYear()
      const currentMonth = today.getMonth() + 1
      const currentDay = today.getDate()
      const progress = totalBudget > 0 ? Math.round((expense / totalBudget) * 100) : 0
      const remain = totalBudget - expense
      const isOverBudget = remain < 0
      const isPastMonth = year < currentYear || (year === currentYear && month < currentMonth)
      const isCurrentMonth = year === currentYear && month === currentMonth
      const daysLeft = isPastMonth ? 0 : isCurrentMonth ? Math.max(0, lastDay - currentDay) : lastDay
      const daysLeftText = isPastMonth ? '本月已结束' : `剩余${daysLeft}天`
      const dailyAllowance = !isOverBudget && daysLeft > 0 ? formatCurrency(Math.floor(Math.max(remain, 0) / daysLeft)) : '0.00'

      let summaryLabel = '剩余可用'
      let summaryValueText = formatCurrency(Math.abs(remain))
      let budgetStatusText = '预算稳定'
      let budgetHintText = ''
      let budgetStatusTone = 'normal'

      if (totalBudget <= 0) {
        summaryLabel = '尚未设置预算'
        summaryValueText = '0.00'
        budgetStatusText = '待设置'
        budgetHintText = '点击右上角进入预算设置，开始追踪本月支出。'
        budgetStatusTone = 'neutral'
      } else if (isOverBudget) {
        summaryLabel = '已超预算'
        summaryValueText = formatCurrency(Math.abs(remain))
        budgetStatusText = '超支预警'
        budgetHintText = `当前已用 ${progress}% · ${daysLeftText}`
        budgetStatusTone = 'danger'
      } else if (progress >= 85) {
        budgetStatusText = '接近上限'
        budgetHintText = `${daysLeftText} · 接下来平均每天可用 ¥${dailyAllowance}`
        budgetStatusTone = 'warning'
      } else if (progress >= 60) {
        budgetStatusText = '需要关注'
        budgetHintText = `${daysLeftText} · 接下来平均每天可用 ¥${dailyAllowance}`
        budgetStatusTone = 'warning'
      } else {
        budgetStatusText = '预算稳定'
        budgetHintText = `${daysLeftText} · 接下来平均每天可用 ¥${dailyAllowance}`
        budgetStatusTone = 'normal'
      }

      this.setData({
        totalBudgetText: formatCurrency(totalBudget),
        expenseText: formatCurrency(expense),
        remainText: formatCurrency(Math.abs(remain)),
        summaryValueText,
        summaryLabel,
        budgetStatusText,
        budgetHintText,
        budgetStatusTone,
        progress,
        progressWidth: Math.min(100, Math.max(0, progress)),
        daysLeft,
        daysLeftText,
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
