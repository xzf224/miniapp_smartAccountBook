import { getCurrencySymbol } from '../../utils/storage'
import { fenToYuan } from '../../models/record'

Component({
  properties: {
    income: { type: String, value: '0.00' },
    expense: { type: String, value: '0.00' },
    balance: { type: String, value: '0.00' },
    expenseBudget: { type: Number, value: 0 },
    expenseRaw: { type: Number, value: 0 },
    daysLeft: { type: Number, value: 0 },
    mixedCount: { type: Number, value: 0 },
    alertVisible: { type: Boolean, value: false },
    alertTone: { type: String, value: 'warning' },
    alertTitle: { type: String, value: '' },
    alertText: { type: String, value: '' },
  },

  data: {
    budgetLabel: '',
    budgetPercent: 0,
    budgetOver: false,
    overAmountText: '',
    currencySymbol: '¥',
  },

  lifetimes: {
    attached() {
      this.setData({ currencySymbol: getCurrencySymbol() })
    },
  },

  pageLifetimes: {
    show() {
      this.setData({ currencySymbol: getCurrencySymbol() })
    },
  },

  observers: {
    'expenseBudget, expenseRaw'(budget: number, raw: number) {
      if (!budget) {
        this.setData({
          budgetLabel: '',
          budgetPercent: 0,
          budgetOver: false,
          overAmountText: '',
        })
        return
      }
      const over = raw > budget
      const percent = over ? 100 : Math.round((raw / budget) * 100)
      const symbol = this.data.currencySymbol
      this.setData({
        budgetLabel: `预算${symbol}${Math.round(budget / 100)}`,
        budgetPercent: percent,
        budgetOver: over,
        overAmountText: over ? fenToYuan(raw - budget) : '',
      })
    },
  },

  methods: {},
})
