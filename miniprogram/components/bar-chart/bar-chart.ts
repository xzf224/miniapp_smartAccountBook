Component({
  properties: {
    data: { type: Array, value: [] as Array<{ label: string; value: number }> },
    barColor: { type: String, value: '#FF7D00' },
    maxValue: { type: Number, value: 0 },
  },

  data: {
    computedBars: [] as Array<{
      label: string
      value: number
      heightPct: number
      active: boolean
      showLabel: boolean
    }>,
  },

  observers: {
    'data, maxValue'() {
      this._compute()
    },
  },

  lifetimes: {
    attached() {
      this._compute()
    },
  },

  methods: {
    _compute() {
      const data: Array<{ label: string; value: number }> = this.data.data
      if (!data || data.length === 0) {
        this.setData({ computedBars: [] })
        return
      }
      const maxVal = this.data.maxValue || Math.max(...data.map(d => d.value), 1)
      const maxIdx = data.reduce(
        (best, item, i, arr) => (item.value > arr[best].value ? i : best),
        0,
      )
      const n = data.length
      const labelStep = n > 12 ? Math.ceil(n / 8) : 1
      const computedBars = data.map((item, i) => ({
        label: item.label,
        value: item.value,
        heightPct: maxVal > 0 ? Math.round((item.value / maxVal) * 100) : 0,
        active: i === maxIdx && item.value > 0,
        showLabel: i % labelStep === 0,
      }))
      this.setData({ computedBars })
    },
  },
})
