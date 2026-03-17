import { CURRENCIES, getCurrencyCode, setCurrencyCode } from '../../utils/storage'

Component({
  data: {
    currencies: CURRENCIES,
    selectedCode: 'CNY',
    currentCurrency: CURRENCIES[0],
  },

  lifetimes: {
    attached() {
      const saved = getCurrencyCode()
      const found = CURRENCIES.find(c => c.code === saved) || CURRENCIES[0]
      this.setData({ selectedCode: saved, currentCurrency: found })
    },
  },

  methods: {
    onSelect(e: any) {
      const code = e.currentTarget.dataset.code as string
      const found = CURRENCIES.find(c => c.code === code) || CURRENCIES[0]
      setCurrencyCode(code)
      this.setData({ selectedCode: code, currentCurrency: found })
      wx.showToast({ title: `已切换为${found.name}`, icon: 'success' })
    },
  },
})
