import { CATEGORY_COLORS, fenToYuan } from '../../models/record'
import { getBudgetAmount, getCategories, getRecords } from '../../utils/storage'

const now = new Date()

Component({
  data: {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    totalBudgetText: '0.00',
    expenseText: '0.00',
    remainText: '0.00',
    progress: 0,
    daysLeft: 0,
    items: [] as Array<{ category: string; spentText: string; budgetText: string; percent: number; color: string }>,
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

      const items = categories.map((category: string) => {
        const budget = getBudgetAmount(year, month, '支出', category)
        if (!budget) return null
        let spent = 0
        records.forEach((item: any) => {
          if (item.category === category) spent += item.amount
        })
        return {
          category,
          spentText: fenToYuan(spent),
          budgetText: fenToYuan(budget),
          percent: budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0,
          color: CATEGORY_COLORS[category] || '#FF8A00',
        }
      }).filter(Boolean) as any[]

      const lastDay = new Date(year, month, 0).getDate()
      const today = new Date().getDate()
      this.setData({
        totalBudgetText: fenToYuan(totalBudget),
        expenseText: fenToYuan(expense),
        remainText: fenToYuan(Math.max(0, totalBudget - expense)),
        progress: totalBudget > 0 ? Math.min(100, Math.round((expense / totalBudget) * 100)) : 0,
        daysLeft: Math.max(0, lastDay - today),
        items,
      })
    },

    onOpenBudgetSetting() {
      wx.navigateTo({ url: '/pages/budget-setting/budget-setting' })
    },
  },
})
