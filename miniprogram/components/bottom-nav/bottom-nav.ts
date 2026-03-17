Component({
  properties: {
    current: {
      type: Number,
      value: 0,
    },
  },

  data: {
    list: [
      {
        pagePath: '/pages/home/home',
        text: '首页',
        iconPath: '/images/new/house.png',
        activeIconPath: '/images/new/house-active.png',
        center: false,
      },
      {
        pagePath: '/pages/budget/budget',
        text: '预算',
        iconPath: '/images/new/wallet-cards.png',
        activeIconPath: '/images/new/wallet-cards-active.png',
        center: false,
      },
      {
        pagePath: '/pages/quick-add/quick-add',
        text: '',
        iconPath: '/images/new/plus.png',
        activeIconPath: '/images/new/plus.png',
        center: true,
      },
      {
        pagePath: '/pages/statistics/statistics',
        text: '统计',
        iconPath: '/images/new/chart-pie.png',
        activeIconPath: '/images/new/chart-pie-active.png',
        center: false,
      },
      {
        pagePath: '/pages/settings/settings',
        text: '我的',
        iconPath: '/images/new/user.png',
        activeIconPath: '/images/new/user-active.png',
        center: false,
      },
    ],
  },

  methods: {
    onNavigate(e: WechatMiniprogram.TouchEvent) {
      const { index, path } = e.currentTarget.dataset as { index: number; path: string }
      if (index === this.properties.current || !path) return
      wx.reLaunch({ url: path })
    },
  },
})
