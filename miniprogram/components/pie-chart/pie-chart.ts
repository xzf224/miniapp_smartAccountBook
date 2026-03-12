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
          const outerR = Math.min(cx, cy) * 0.85
          const innerR = outerR * 0.55

          // Step 1: draw pizza wedges with slight overlap to cover aa gaps
          let startAngle = -Math.PI / 2
          for (const item of data) {
            const sweep = (item.value / total) * 2 * Math.PI
            ctx.beginPath()
            ctx.moveTo(cx, cy)
            ctx.arc(cx, cy, outerR, startAngle, startAngle + sweep + 0.03)
            ctx.closePath()
            ctx.fillStyle = item.color
            ctx.fill()
            startAngle += sweep
          }

          // Step 2: white radial separators for crisp edges
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 1.5
          startAngle = -Math.PI / 2
          for (const item of data) {
            ctx.beginPath()
            ctx.moveTo(cx + innerR * Math.cos(startAngle), cy + innerR * Math.sin(startAngle))
            ctx.lineTo(cx + outerR * Math.cos(startAngle), cy + outerR * Math.sin(startAngle))
            ctx.stroke()
            startAngle += (item.value / total) * 2 * Math.PI
          }

          // Step 3: white inner circle for donut hole
          ctx.beginPath()
          ctx.arc(cx, cy, innerR, 0, 2 * Math.PI)
          ctx.fillStyle = '#ffffff'
          ctx.fill()

          // Center text
          const totalText = this.data.total || ''
          ctx.fillStyle = '#353535'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.font = `bold ${Math.round(outerR * 0.22)}px sans-serif`
          ctx.fillText(totalText, cx, cy)
        })
    },
  },
})
