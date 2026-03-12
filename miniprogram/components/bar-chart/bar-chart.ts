Component({
  properties: {
    data: { type: Array, value: [] as Array<{ label: string; value: number }> },
    barColor: { type: String, value: '#5B8FF9' },
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

          const paddingLeft = 50
          const paddingRight = 20
          const paddingTop = 20
          const paddingBottom = 40
          const chartW = W - paddingLeft - paddingRight
          const chartH = H - paddingTop - paddingBottom

          const maxVal = this.data.maxValue || Math.max(...chartData.map(d => d.value), 1)
          const step = Math.ceil(maxVal / 4)
          const nicMax = step * 4

          // Draw grid lines
          ctx.strokeStyle = '#EEEEEE'
          ctx.lineWidth = 1
          for (let i = 0; i <= 4; i++) {
            const y = paddingTop + chartH - (i / 4) * chartH
            ctx.beginPath()
            ctx.moveTo(paddingLeft, y)
            ctx.lineTo(paddingLeft + chartW, y)
            ctx.stroke()
            // Y axis labels
            ctx.fillStyle = '#AAAAAA'
            ctx.textAlign = 'right'
            ctx.textBaseline = 'middle'
            ctx.font = '10px sans-serif'
            const labelVal = (step * i / 100).toFixed(0)
            ctx.fillText(labelVal, paddingLeft - 4, y)
          }

          // Draw bars
          const n = chartData.length
          const barGroupW = chartW / n
          const barW = Math.max(barGroupW * 0.6, 4)
          const radius = Math.min(4, barW / 2)

          // Show every Nth label to avoid crowding
          const labelStep = Math.ceil(n / 12)

          for (let i = 0; i < n; i++) {
            const item = chartData[i]
            const barH = (item.value / nicMax) * chartH
            const x = paddingLeft + i * barGroupW + (barGroupW - barW) / 2
            const y = paddingTop + chartH - barH

            // Bar with rounded top
            ctx.fillStyle = this.data.barColor
            ctx.beginPath()
            if (barH > radius) {
              ctx.moveTo(x + radius, y)
              ctx.lineTo(x + barW - radius, y)
              ctx.arcTo(x + barW, y, x + barW, y + radius, radius)
              ctx.lineTo(x + barW, paddingTop + chartH)
              ctx.lineTo(x, paddingTop + chartH)
              ctx.lineTo(x, y + radius)
              ctx.arcTo(x, y, x + radius, y, radius)
            } else {
              ctx.rect(x, paddingTop + chartH - (barH || 1), barW, barH || 1)
            }
            ctx.closePath()
            ctx.fill()

            // X axis label
            if (i % labelStep === 0) {
              ctx.fillStyle = '#AAAAAA'
              ctx.textAlign = 'center'
              ctx.textBaseline = 'top'
              ctx.font = '10px sans-serif'
              ctx.fillText(item.label, x + barW / 2, paddingTop + chartH + 6)
            }
          }
        })
    },
  },
})
