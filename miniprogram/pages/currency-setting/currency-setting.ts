const CURRENCY_KEY = 'app_currency'

const CURRENCIES = [
  { code: 'CNY', symbol: '¥', name: '人民币' },
  { code: 'USD', symbol: '$', name: '美元' },
  { code: 'EUR', symbol: '€', name: '欧元' },
  { code: 'JPY', symbol: '¥', name: '日元' },
  { code: 'HKD', symbol: 'HK$', name: '港币' },
  { code: 'GBP', symbol: '£', name: '英镑' },
  { code: 'KRW', symbol: '₩', name: '韩元' },
  { code: 'SGD', symbol: 'S$', name: '新加坡元' },
]

Component({
  data: {
    currencies: CURRENCIES,
    selectedCode: 'CNY',
    currentCurrency: CURRENCIES[0],
  },

  lifetimes: {
    attached() {
      const saved = wx.getStorageSync(CURRENCY_KEY) || 'CNY'
      const found = CURRENCIES.find(c => c.code === saved) || CURRENCIES[0]
      this.setData({ selectedCode: saved, currentCurrency: found })
    },
  },

  methods: {
    onSelect(e: any) {
      const code = e.currentTarget.dataset.code as string
      const found = CURRENCIES.find(c => c.code === code) || CURRENCIES[0]
      wx.setStorageSync(CURRENCY_KEY, code)
      this.setData({ selectedCode: code, currentCurrency: found })
      wx.showToast({ title: `已切换为${found.name}`, icon: 'success' })
    },
  },
})
