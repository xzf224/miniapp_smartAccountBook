Component({
  properties: {
    data: { type: Array, value: [] as Array<{ label: string; value: number }> },
    barColor: { type: String, value: '#FF8A00' },
    maxValue: { type: Number, value: 0 },
  },

  observers: {
    data() {
      this._scheduleDraw()
    },
  },

  lifetimes: {
    attached() {
      this._scheduleDraw()
    },
  },

  methods: {
    _scheduleDraw() {
      setTimeout(() => { this.drawChart() }, 100)
    },

    drawChart() {
      const chartData: Array<{ label: string; value: number }> = this.data.data
      if (!chartData || chartData.length === 0) return

      const query = this.createSelectorQuery()
      query.select('#barChart')
        .fields({ node: true, size: true })
        .exec((res: any[]) => {
          if (!res || !res[0] || !res[0].node) return
          const canvas = res[0].node
          const ctx = canvas.getContext('2d')
          const dpr = (wx as any).getWindowInfo ? (wx as any).getWindowInfo().pixelRatio : 2
          const W = res[0].width
          const H = res[0].height
          canvas.width = W * dpr
          canvas.height = H * dpr
          ctx.scale(dpr, dpr)
          ctx.clearRect(0, 0, W, H)

          const paddingLeft = 8
          const paddingRight = 8
          const paddingTop = 10
          const paddingBottom = 30
          const chartW = W - paddingLeft - paddingRight
          const chartH = H - paddingTop - paddingBottom

          const n = chartData.length
          const maxVal = this.data.maxValue || Math.max(...chartData.map(d => d.value), 1)
          const activeIndex = chartData.reduce((best, item, index, source) => (
            item.value > source[best].value ? index : best
          ), 0)
          const groupWidth = chartW / n
          const barW = Math.min(28, Math.max(10, groupWidth * 0.48))
          const maxBarHeight = Math.max(chartH - 18, 60)
          const radius = Math.min(6, barW / 2)
          const labelStep = n > 12 ? Math.ceil(n / 8) : 1
          const inactiveBarColor = '#FFF5E6'

          for (let i = 0; i < n; i++) {
            const item = chartData[i]
            const normalizedHeight = maxVal === 0 ? 0 : (item.value / maxVal) * maxBarHeight
            const barH = item.value > 0 ? Math.max(normalizedHeight, 12) : 0
            const x = paddingLeft + i * groupWidth + (groupWidth - barW) / 2
            const y = paddingTop + maxBarHeight - barH
            const isActive = i === activeIndex && item.value > 0

            if (barH > 0) {
              this.drawRoundedRect(ctx, x, y, barW, barH, radius)
              ctx.fillStyle = isActive ? this.data.barColor : inactiveBarColor
              ctx.fill()
            }

            if (i % labelStep === 0) {
              ctx.fillStyle = isActive ? '#1A1A1A' : '#9CA3AF'
              ctx.textAlign = 'center'
              ctx.textBaseline = 'top'
              ctx.font = `${isActive ? '600' : '400'} 10px sans-serif`
              ctx.fillText(item.label, x + barW / 2, paddingTop + maxBarHeight + 8)
            }
          }
        })
    },

    drawRoundedRect(
      ctx: any,
      x: number,
      y: number,
      width: number,
      height: number,
      radius: number,
    ) {
      const safeRadius = Math.min(radius, width / 2, height / 2)
      ctx.beginPath()
      ctx.moveTo(x + safeRadius, y)
      ctx.arcTo(x + width, y, x + width, y + height, safeRadius)
      ctx.arcTo(x + width, y + height, x, y + height, 0)
      ctx.arcTo(x, y + height, x, y, 0)
      ctx.arcTo(x, y, x + width, y, safeRadius)
      ctx.closePath()
    },
  },
})
