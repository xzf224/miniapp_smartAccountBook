import { exportRecordsCSV, clearAllRecords } from '../../utils/storage'

Component({
  data: {
    version: (getApp() as any).globalData.version as string,
  },

  methods: {
    onBudgetSetting() {
      wx.navigateTo({ url: '/pages/budget-setting/budget-setting' })
    },

    onCategoryManage() {
      wx.navigateTo({ url: '/pages/category-manage/category-manage' })
    },

    onRecurring() {
      wx.navigateTo({ url: '/pages/recurring/recurring' })
    },

    onExportData() {
      const csv = exportRecordsCSV()
      if (!csv) {
        wx.showToast({ title: '暂无记录可导出', icon: 'none' })
        return
      }
      // 清理之前导出的旧账单文件，避免长期累积占用空间
      try {
        const fs = wx.getFileSystemManager()
        const files = fs.readdirSync(wx.env.USER_DATA_PATH)
        files.forEach((name: string) => {
          if (name.startsWith('账单_') && name.endsWith('.csv')) {
            try { fs.unlinkSync(`${wx.env.USER_DATA_PATH}/${name}`) } catch (_) {}
          }
        })
      } catch (_) {}

      const dateStr = new Date().toISOString().slice(0, 10)
      const filePath = `${wx.env.USER_DATA_PATH}/账单_${dateStr}.csv`
      try {
        wx.getFileSystemManager().writeFileSync(filePath, csv, 'utf8')
      } catch (e) {
        wx.showToast({ title: '写入文件失败', icon: 'none' })
        return
      }
      // 同步写完后立即触发分享，保持在用户手势调用链内
      ;(wx as any).shareFileMessage({
        filePath,
        fail: (err: any) => {
          // 用户主动关闭分享面板属于正常取消，不提示错误
          const msg: string = (err && err.errMsg) || ''
          if (msg.includes('cancel')) return
          // shareFileMessage 不可用时降级：提示路径让用户知道文件已存在
          wx.showModal({
            title: '文件已导出',
            content: `文件写入成功，但分享面板打开失败。\n请升级微信后重试。\n\n文件：账单_${dateStr}.csv`,
            showCancel: false,
            confirmText: '好',
          })
        },
      })
    },

    onClearAll() {
      wx.showModal({
        title: '确认清空',
        content: '将清空所有账单数据，此操作不可撤销！',
        confirmText: '清空',
        confirmColor: '#ff4d4f',
        success: (res) => {
          if (res.confirm) {
            clearAllRecords()
            wx.showToast({ title: '已清空', icon: 'success' })
          }
        }
      })
    },

    onShareAppMessage() {
      return {
        title: '智能记账本 - 轻松管理每日收支',
        path: '/pages/home/home'
      }
    },

    onShareTimeline() {
      return {
        title: '智能记账本 - 轻松管理每日收支'
      }
    }
  }
})
