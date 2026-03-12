const ACTION_WIDTH = 160  // rpx → px conversion handled at runtime

Component({
  data: {
    offsetX: 0,
    startX: 0,
    actionWidthPx: 120,  // updated on attached (240rpx)
    opened: false,
  },

  lifetimes: {
    attached() {
      const wx_ = wx as any
      const windowWidth: number = typeof wx_.getWindowInfo === 'function'
        ? wx_.getWindowInfo().windowWidth
        : wx.getSystemInfoSync().windowWidth
      this.data.actionWidthPx = (240 / 750) * windowWidth
    },
  },

  methods: {
    onTouchStart(e: WechatMiniprogram.TouchEvent) {
      this.data.startX = e.touches[0].clientX
    },

    onTouchMove(e: WechatMiniprogram.TouchEvent) {
      const deltaX = e.touches[0].clientX - this.data.startX
      const maxLeft = -this.data.actionWidthPx
      let offsetX = this.data.opened ? (deltaX - this.data.actionWidthPx) : deltaX
      offsetX = Math.max(maxLeft, Math.min(0, offsetX))
      this.setData({ offsetX })
    },

    onTouchEnd(e: WechatMiniprogram.TouchEvent) {
      const deltaX = e.changedTouches[0].clientX - this.data.startX
      const threshold = this.data.actionWidthPx / 2
      const shouldOpen = this.data.opened ? deltaX > -threshold : deltaX < -threshold
      if (shouldOpen) {
        this.setData({ offsetX: -this.data.actionWidthPx, opened: true })
      } else {
        this.setData({ offsetX: 0, opened: false })
      }
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
      this.setData({ offsetX: 0, opened: false })
    },
  },
})
