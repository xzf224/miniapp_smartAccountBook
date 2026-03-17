function formatCompactAmount(fen: number): string {
  const yuan = fen / 100
  if (yuan >= 10000) return `${(yuan / 10000).toFixed(yuan >= 100000 ? 0 : 1)}w`
  if (yuan >= 1000) return `${(yuan / 1000).toFixed(yuan >= 10000 ? 0 : 1)}k`
  const digits = yuan >= 100 ? 0 : yuan >= 10 ? 1 : 2
  return yuan.toFixed(digits).replace(/\.0$/, '').replace(/\.00$/, '')
}

Component({
  properties: {
    data: { type: Array, value: [] as Array<{ label: string; value: number }> },
    barColor: { type: String, value: '#FF7D00' },
    maxValue: { type: Number, value: 0 },
    activeIndex: { type: Number, value: -1 },
  },

  data: {
    computedBars: [] as Array<{
      label: string
      value: number
      heightPct: number
      active: boolean
      showLabel: boolean
      valueText: string
    }>,
  },

  observers: {
    'data, maxValue, activeIndex'() {
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
      const activeIdx = this.data.activeIndex >= 0 && this.data.activeIndex < data.length
        ? this.data.activeIndex
        : maxIdx
      const n = data.length
      const labelStep = n > 12 ? Math.ceil(n / 8) : 1
      const computedBars = data.map((item, i) => ({
        label: item.label,
        value: item.value,
        heightPct: maxVal > 0 ? Math.round((item.value / maxVal) * 100) : 0,
        active: i === activeIdx,
        showLabel: i % labelStep === 0,
        valueText: formatCompactAmount(item.value),
      }))
      this.setData({ computedBars })
    },

    onSelectBar(e: WechatMiniprogram.TouchEvent) {
      const index = Number((e.currentTarget.dataset as { index?: number }).index)
      const item = this.data.computedBars[index]
      if (!item) return
      this.triggerEvent('select', {
        index,
        label: item.label,
        value: item.value,
        valueText: item.valueText,
      })
    },
  },
})
