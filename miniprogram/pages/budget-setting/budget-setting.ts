import { getCategories, getBudgets, upsertBudget, deleteBudget } from '../../utils/storage'
import { IBudget, fenToYuan, yuanToFen } from '../../models/record'

const PICKER_YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(String)
const PICKER_MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))

interface BudgetItem {
  category: string
  budgetYuan: string
}

Component({
  data: {
    typeIndex: 0,
    types: ['支出', '收入'],
    useMonthly: false,
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    pickerRange: [PICKER_YEARS, PICKER_MONTHS],
    pickerValue: [5, new Date().getMonth()],
    totalBudgetYuan: '',
    categoryBudgets: [] as BudgetItem[],
  },

  lifetimes: {
    attached() {
      this.loadData()
    }
  },

  methods: {
    loadData() {
      const { typeIndex, useMonthly, year, month } = this.data
      const type: '支出' | '收入' = typeIndex === 0 ? '支出' : '收入'
      const useYear = useMonthly ? year : 0
      const useMonth = useMonthly ? month : 0

      const budgets = getBudgets()
      const totalEntry = budgets.find(
        b => b.type === type && b.category === '__total__' && b.year === useYear && b.month === useMonth
      )
      const totalFen = totalEntry ? totalEntry.amount : 0
      const totalBudgetYuan = totalFen > 0 ? fenToYuan(totalFen).toString() : ''

      const categories = getCategories()
      const catList: string[] = typeIndex === 0 ? categories['支出'] : categories['收入']
      const categoryBudgets: BudgetItem[] = catList.map((cat: string) => {
        const entry = budgets.find(
          b => b.type === type && b.category === cat && b.year === useYear && b.month === useMonth
        )
        const fen = entry ? entry.amount : 0
        return {
          category: cat,
          budgetYuan: fen > 0 ? fenToYuan(fen).toString() : ''
        }
      })

      this.setData({ totalBudgetYuan, categoryBudgets })
    },

    onTypeChange(e: WechatMiniprogram.CustomEvent) {
      const typeIndex = Number(e.currentTarget.dataset.index)
      this.setData({ typeIndex }, () => this.loadData())
    },

    onPickerChange(e: WechatMiniprogram.CustomEvent) {
      const [yi, mi] = e.detail.value as number[]
      const year = parseInt(PICKER_YEARS[yi])
      const month = parseInt(PICKER_MONTHS[mi])
      this.setData({ year, month, pickerValue: [yi, mi] }, () => this.loadData())
    },

    onMonthlyToggle(e: WechatMiniprogram.CustomEvent) {
      const useMonthly = e.detail.value
      this.setData({ useMonthly }, () => this.loadData())
    },

    onTotalInput(e: WechatMiniprogram.CustomEvent) {
      this.setData({ totalBudgetYuan: e.detail.value })
    },

    onCategoryInput(e: WechatMiniprogram.CustomEvent) {
      const index = Number(e.currentTarget.dataset.index)
      const categoryBudgets = this.data.categoryBudgets.slice()
      categoryBudgets[index] = { ...categoryBudgets[index], budgetYuan: e.detail.value }
      this.setData({ categoryBudgets })
    },

    onSave() {
      const { typeIndex, useMonthly, year, month, totalBudgetYuan, categoryBudgets } = this.data
      const type: '支出' | '收入' = typeIndex === 0 ? '支出' : '收入'
      const useYear = useMonthly ? year : 0
      const useMonth = useMonthly ? month : 0

      const totalYuan = parseFloat(totalBudgetYuan)
      if (totalBudgetYuan === '' || isNaN(totalYuan)) {
        deleteBudget(useYear, useMonth, type, '__total__')
      } else {
        const budget: IBudget = { year: useYear, month: useMonth, type, category: '__total__', amount: yuanToFen(totalYuan) }
        upsertBudget(budget)
      }

      categoryBudgets.forEach(({ category, budgetYuan }) => {
        const val = parseFloat(budgetYuan)
        if (budgetYuan === '' || isNaN(val)) {
          deleteBudget(useYear, useMonth, type, category)
        } else {
          const budget: IBudget = { year: useYear, month: useMonth, type, category, amount: yuanToFen(val) }
          upsertBudget(budget)
        }
      })

      wx.showToast({ title: '保存成功', icon: 'success' })
    }
  }
})
