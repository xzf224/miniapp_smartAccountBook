Component({
  properties: {
    income: { type: String, value: '0.00' },
    expense: { type: String, value: '0.00' },
    balance: { type: String, value: '0.00' },
    expenseBudget: { type: Number, value: 0 },
    expenseRaw: { type: Number, value: 0 },
  },

  data: {
    budgetLabel: '',
    budgetPercent: 0,
    budgetOver: false,
  },

  observers: {
    'expenseBudget, expenseRaw'(budget: number, raw: number) {
      if (!budget) return
      const percent = raw > budget ? 100 : Math.round((raw / budget) * 100)
      this.setData({
        budgetLabel: '预算¥' + Math.round(budget / 100),
        budgetPercent: percent,
        budgetOver: raw > budget,
      })
    },
  },

  methods: {},
})
