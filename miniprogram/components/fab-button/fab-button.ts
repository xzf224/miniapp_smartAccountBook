Component({
  data: {
    expanded: false,
    posRight: 40,
    posBottom: 80,
    popUp: true,
    popLeft: false,
    subStyle: '',
  },

  lifetimes: {
    attached() {
      const wx_ = wx as any
      const info = typeof wx_.getWindowInfo === 'function'
        ? wx_.getWindowInfo()
        : wx.getSystemInfoSync()
      const W: number = info.windowWidth
      const H: number = info.windowHeight
      const self = this as any
      self._W = W
      self._H = H
      self._btn = Math.round(104 * W / 750)
      const margin = Math.round(40 * W / 750)
      const safeBottom = info.safeArea ? H - info.safeArea.bottom : 0
      const TAB_BAR_HEIGHT = 50
      const bottom = Math.round(80 * W / 750) + safeBottom + TAB_BAR_HEIGHT
      this.setData({ posRight: margin, posBottom: bottom })
      ;(this as any)._updateDirection()
    },
  },

  methods: {
    onTouchStart(e: WechatMiniprogram.TouchEvent) {
      const self = this as any
      self._sx = e.touches[0].clientX
      self._sy = e.touches[0].clientY
      self._ir = this.data.posRight
      self._ib = this.data.posBottom
      self._moved = false
    },

    onTouchMove(e: WechatMiniprogram.TouchEvent) {
      const self = this as any
      const dx = e.touches[0].clientX - self._sx
      const dy = e.touches[0].clientY - self._sy
      if (!self._moved && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
        self._moved = true
        if (this.data.expanded) this.setData({ expanded: false })
      }
      const W = self._W as number
      const H = self._H as number
      const btn = self._btn as number
      const r = Math.max(0, Math.min(W - btn, self._ir - dx))
      const b = Math.max(0, Math.min(H - btn, self._ib - dy))
      this.setData({ posRight: r, posBottom: b })
    },

    onTouchEnd() {
      const self = this as any
      if (!self._moved) {
        this.toggle()
        return
      }
      // Snap to nearest left or right edge
      const W = self._W as number
      const btn = self._btn as number
      const edgeMargin = Math.round(20 * W / 750)
      const btnCenterX = W - this.data.posRight - btn / 2
      this.setData({
        posRight: btnCenterX < W / 2
          ? W - btn - edgeMargin   // snap to left edge
          : edgeMargin              // snap to right edge
      })
      ;(this as any)._updateDirection()
    },

    _updateDirection() {
      const self = this as any
      const H = self._H as number
      const W = self._W as number
      const btn = self._btn as number
      const gap = 16
      const { posRight, posBottom } = this.data
      const popUp = posBottom < H / 2
      const popLeft = posRight > W / 2
      let subStyle = ''
      if (popUp) {
        subStyle += `bottom: ${posBottom + btn + gap}px; `
      } else {
        subStyle += `top: ${H - posBottom + gap}px; `
      }
      if (popLeft) {
        subStyle += `left: ${W - posRight - btn}px;`
      } else {
        subStyle += `right: ${posRight}px;`
      }
      this.setData({ popUp, popLeft, subStyle })
    },

    toggle() {
      this.setData({ expanded: !this.data.expanded })
    },

    onManual() {
      this.setData({ expanded: false })
      this.triggerEvent('manual')
    },

    onVoice() {
      this.setData({ expanded: false })
      this.triggerEvent('voice')
    },

    onPhoto() {
      this.setData({ expanded: false })
      this.triggerEvent('photo')
    },

    onOverlayTap() {
      this.setData({ expanded: false })
    },
  },
})
