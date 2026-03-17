Component({
  properties: {
    data: { type: Array, value: [] as Array<{ name: string; value: number; color: string }> },
    total: { type: String, value: '' },
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
      // Defer to ensure canvas node is ready
      setTimeout(() => { this.drawChart() }, 100)
    },

    drawChart() {
      const data: Array<{ name: string; value: number; color: string }> = this.data.data
      if (!data || data.length === 0) return

      const total = data.reduce((s, d) => s + d.value, 0)
      if (total === 0) return

      const query = this.createSelectorQuery()
      query.select('#pieChart')
        .fields({ node: true, size: true })
        .exec((res: any[]) => {
          if (!res || !res[0] || !res[0].node) return
          const canvas = res[0].node
          const ctx = canvas.getContext('2d')
          const dpr = (wx as any).getWindowInfo ? (wx as any).getWindowInfo().pixelRatio : 2
          const width = res[0].width
          const height = res[0].height
          canvas.width = width * dpr
          canvas.height = height * dpr
          ctx.scale(dpr, dpr)

          ctx.clearRect(0, 0, width, height)

          const cx = width / 2
          const cy = height / 2
          const outerR = Math.min(cx, cy) * 0.78
          const ringWidth = Math.max(12, outerR * 0.24)
          const innerR = outerR - ringWidth

          ctx.lineWidth = ringWidth
          ctx.lineCap = 'round'
          ctx.strokeStyle = '#FFF5E6'
          ctx.beginPath()
          ctx.arc(cx, cy, outerR - ringWidth / 2, 0, 2 * Math.PI)
          ctx.stroke()

          let startAngle = -Math.PI / 2
          for (const item of data) {
            const sweep = (item.value / total) * 2 * Math.PI
            const gap = data.length > 1 ? Math.min(0.05, sweep * 0.18) : 0
            const arcStart = startAngle + gap / 2
            const arcEnd = startAngle + sweep - gap / 2

            if (arcEnd > arcStart) {
              ctx.beginPath()
              ctx.strokeStyle = item.color
              ctx.arc(cx, cy, outerR - ringWidth / 2, arcStart, arcEnd)
              ctx.stroke()
            }

            startAngle += sweep
          }

          ctx.beginPath()
          ctx.arc(cx, cy, innerR, 0, 2 * Math.PI)
          ctx.fillStyle = '#ffffff'
          ctx.fill()

          const totalText = this.data.total || ''
          ctx.fillStyle = '#353535'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.font = `700 ${Math.round(outerR * 0.28)}px sans-serif`
          ctx.fillText(totalText, cx, cy)
        })
    },
  },
})
