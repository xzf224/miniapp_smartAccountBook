Component({
  properties: {
    opened: {
      type: Boolean,
      value: false,
      observer(opened: boolean) {
        this.setData({
          offsetX: opened ? -this.data.actionWidthPx : 0,
        })
      },
    },
  },

  data: {
    offsetX: 0,
    startX: 0,
    startY: 0,
    startOffsetX: 0,
    actionWidthPx: 120,  // updated on attached (240rpx)
    lockDirection: '',
  },

  lifetimes: {
    attached() {
      const wx_ = wx as any
      const windowWidth: number = typeof wx_.getWindowInfo === 'function'
        ? wx_.getWindowInfo().windowWidth
        : wx.getSystemInfoSync().windowWidth
      const actionWidthPx = (240 / 750) * windowWidth
      this.setData({
        actionWidthPx,
        offsetX: this.data.opened ? -actionWidthPx : 0,
      })
    },
  },

  methods: {
    syncOpenState(nextOpened: boolean) {
      this.setData({
        offsetX: nextOpened ? -this.data.actionWidthPx : 0,
      })
      this.triggerEvent(nextOpened ? 'open' : 'close')
    },

    onTouchStart(e: WechatMiniprogram.TouchEvent) {
      this.data.startX = e.touches[0].clientX
      this.data.startY = e.touches[0].clientY
      this.data.startOffsetX = this.data.offsetX
      this.setData({ lockDirection: '' })
    },

    onTouchMove(e: WechatMiniprogram.TouchEvent) {
      const deltaX = e.touches[0].clientX - this.data.startX
      const deltaY = e.touches[0].clientY - this.data.startY
      const absX = Math.abs(deltaX)
      const absY = Math.abs(deltaY)

      let lockDirection = this.data.lockDirection
      if (!lockDirection) {
        if (absX < 6 && absY < 6) return
        lockDirection = absX > absY ? 'horizontal' : 'vertical'
        this.setData({ lockDirection })
      }

      if (lockDirection !== 'horizontal') return

      const maxLeft = -this.data.actionWidthPx
      let offsetX = this.data.startOffsetX + deltaX
      offsetX = Math.max(maxLeft, Math.min(0, offsetX))
      this.setData({ offsetX })
    },

    onTouchEnd() {
      if (this.data.lockDirection !== 'horizontal') {
        this.setData({ lockDirection: '' })
        return
      }

      const shouldOpen = this.data.offsetX <= -this.data.actionWidthPx * 0.35
      this.syncOpenState(shouldOpen)
      this.setData({ lockDirection: '' })
    },

    onEdit() {
      this.close()
      this.triggerEvent('edit')
    },

    onDelete() {
      this.close()
      this.triggerEvent('delete')
    },

    close() {
      this.syncOpenState(false)
    },
  },
})
