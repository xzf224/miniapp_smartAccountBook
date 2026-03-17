Component({
  properties: {
    data: { type: Array, value: [] as Array<{ name: string; value: number; color: string }> },
    total: { type: String, value: '' },
    title: { type: String, value: '' },
    activeName: { type: String, value: '' },
  },

  data: {
    computedSlices: [] as Array<{
      name: string
      color: string
      pctText: string
      amountText: string
      active: boolean
    }>,
    gradientStyle: '',
  },

  observers: {
    'data, activeName'() {
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
      const data: Array<{ name: string; value: number; color: string }> = this.data.data
      if (!data || data.length === 0) {
        this.setData({ computedSlices: [], gradientStyle: '' })
        return
      }
      const total = data.reduce((s, d) => s + d.value, 0)
      if (total === 0) {
        this.setData({ computedSlices: [], gradientStyle: '' })
        return
      }

      let cumPct = 0
      const segments: string[] = []
      const computedSlices = data.map(item => {
        const pct = (item.value / total) * 100
        const start = cumPct
        cumPct += pct
        const end = Math.min(cumPct, 100)
        segments.push(`${item.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`)

        const yuan = item.value / 100
        const amountText = yuan >= 1000
          ? `${(yuan / 1000).toFixed(1)}k`
          : yuan.toFixed(0)

        return {
          name: item.name,
          color: item.color,
          pctText: pct >= 1 ? `${Math.round(pct)}%` : '<1%',
          amountText,
          active: item.name === this.data.activeName,
        }
      })

      const gradientStyle = `conic-gradient(${segments.join(', ')})`
      this.setData({ computedSlices, gradientStyle })
    },

    onSelectSlice(e: WechatMiniprogram.TouchEvent) {
      const detail = e.currentTarget.dataset as {
        name?: string
        amount?: string
        pct?: string
        color?: string
      }
      if (!detail.name) return
      this.triggerEvent('select', {
        name: detail.name,
        amountText: detail.amount || '',
        percentageText: detail.pct || '',
        color: detail.color || '',
      })
    },
  },
})
