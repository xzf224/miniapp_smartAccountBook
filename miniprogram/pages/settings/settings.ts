import {
  exportBackupJSON,
  exportRecordsCSV,
  clearAllRecords,
  getCategories,
  getRecords,
  getUserProfile,
  restoreBackupJSON,
  saveUserProfile,
} from '../../utils/storage'

Component({
  data: {
    version: (getApp() as any).globalData.version as string,
    statRecords: 0,
    statCategories: 0,
    statConsecutiveDays: 0,
    statTotalDays: 0,
    profileAvatarUrl: '',
    profileNickname: '',
    profilePersonalized: false,
    profileEditing: false,
    draftAvatarUrl: '',
    draftNickname: '',
  },

  lifetimes: {
    attached() {
      this.loadStats()
    },
  },

  pageLifetimes: {
    show() {
      this.loadStats()
    },
  },

  methods: {
    loadStats() {
      const records = getRecords()
      const categories = getCategories()
      const userProfile = getUserProfile()
      const now = new Date()
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const monthCount = records.filter((item: any) => item.date.startsWith(monthStr)).length
      const categoryCount = categories['支出'].length + categories['收入'].length

      // 已记账天数：有记录的不同日期总数
      const daySet = new Set<string>(records.map((r: any) => r.date as string))
      const statTotalDays = daySet.size

      // 连续记账天数：从今天起倒数连续有记录的天数
      let statConsecutiveDays = 0
      for (let i = 0; i < 365; i++) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        if (daySet.has(dateStr)) {
          statConsecutiveDays++
        } else {
          break
        }
      }

      this.setData({
        statRecords: monthCount,
        statCategories: categoryCount,
        statConsecutiveDays,
        statTotalDays,
        profileAvatarUrl: userProfile.avatarUrl,
        profileNickname: userProfile.nickname,
        profilePersonalized: userProfile.personalized,
        draftAvatarUrl: userProfile.avatarUrl,
        draftNickname: userProfile.nickname,
        profileEditing: false,
      })
    },

    onProfileCardTap() {
      if (this.data.profilePersonalized) {
        this.setData({
          profileEditing: true,
          draftAvatarUrl: this.data.profileAvatarUrl,
          draftNickname: this.data.profileNickname,
        })
        return
      }

      wx.showModal({
        title: '开启个性化',
        content: '设置头像和昵称后，我的页面会展示你的专属资料。信息仅保存在当前设备。',
        confirmText: '去设置',
        confirmColor: '#ff8a00',
        success: (res) => {
          if (!res.confirm) return
          this.setData({
            profileEditing: true,
            draftAvatarUrl: this.data.profileAvatarUrl,
            draftNickname: this.data.profileNickname,
          })
        },
      })
    },

    onChooseAvatar(e: WechatMiniprogram.CustomEvent) {
      const avatarUrl = (e.detail as any)?.avatarUrl || ''
      if (!avatarUrl) return
      this.setData({ draftAvatarUrl: avatarUrl })
    },

    onNicknameInput(e: WechatMiniprogram.Input) {
      const draftNickname = e.detail.value
      this.setData({ draftNickname })
    },

    onProfileCancel() {
      this.setData({
        profileEditing: false,
        draftAvatarUrl: this.data.profileAvatarUrl,
        draftNickname: this.data.profileNickname,
      })
    },

    onProfileSave() {
      const nickname = this.data.draftNickname.trim()
      const avatarUrl = this.data.draftAvatarUrl
      saveUserProfile({
        avatarUrl,
        nickname,
        personalized: true,
      })
      this.setData({
        profileAvatarUrl: avatarUrl,
        profileNickname: nickname,
        profilePersonalized: true,
        profileEditing: false,
      })
      wx.showToast({ title: '已保存', icon: 'success' })
    },

    onBudgetSetting() {
      wx.reLaunch({ url: '/pages/budget/budget' })
    },

    onCategoryManage() {
      wx.navigateTo({ url: '/pages/category-manage/category-manage' })
    },

    onRecurring() {
      wx.navigateTo({ url: '/pages/recurring/recurring' })
    },

    writeShareFile(fileName: string, content: string) {
      try {
        const fs = wx.getFileSystemManager()
        const files = fs.readdirSync(wx.env.USER_DATA_PATH)
        files.forEach((name: string) => {
          if (name === fileName) {
            try { fs.unlinkSync(`${wx.env.USER_DATA_PATH}/${name}`) } catch (_) {}
          }
        })
      } catch (_) {
        // ignore stale file cleanup failure
      }

      const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`
      try {
        wx.getFileSystemManager().writeFileSync(filePath, content, 'utf8')
      } catch (e) {
        wx.showToast({ title: '写入文件失败', icon: 'none' })
        return
      }

      ;(wx as any).shareFileMessage({
        filePath,
        fail: (err: any) => {
          const msg: string = (err && err.errMsg) || ''
          if (msg.includes('cancel')) return
          wx.showModal({
            title: '文件已导出',
            content: `文件写入成功，但分享面板打开失败。\n请升级微信后重试。\n\n文件：${fileName}`,
            showCancel: false,
            confirmText: '好',
          })
        },
      })
    },

    onBackupData() {
      const backup = exportBackupJSON()
      const dateStr = new Date().toISOString().slice(0, 10)
      this.writeShareFile(`记账备份_${dateStr}.json`, backup)
    },

    onRestoreData() {
      if (!(wx as any).chooseMessageFile) {
        wx.showToast({ title: '当前基础库不支持恢复', icon: 'none' })
        return
      }

      ;(wx as any).chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['json'],
        success: (res: any) => {
          const file = res.tempFiles?.[0]
          const path = file?.path
          if (!path) {
            wx.showToast({ title: '未获取到备份文件', icon: 'none' })
            return
          }

          wx.showModal({
            title: '恢复备份',
            content: '恢复后会覆盖当前账单、分类、预算和规则数据，是否继续？',
            confirmText: '恢复',
            confirmColor: '#ff8a00',
            success: modalRes => {
              if (!modalRes.confirm) return
              wx.getFileSystemManager().readFile({
                filePath: path,
                encoding: 'utf8',
                success: readRes => {
                  try {
                    const restored = restoreBackupJSON(readRes.data as string)
                    if (!restored) {
                      wx.showToast({ title: '备份文件格式错误', icon: 'none' })
                      return
                    }
                    this.loadStats()
                    wx.showToast({ title: '恢复成功', icon: 'success' })
                  } catch (_) {
                    wx.showToast({ title: '恢复失败', icon: 'none' })
                  }
                },
                fail: () => {
                  wx.showToast({ title: '读取备份文件失败', icon: 'none' })
                },
              })
            },
          })
        },
      })
    },

    onExportData() {
      const csv = exportRecordsCSV()
      if (!csv) {
        wx.showToast({ title: '暂无记录可导出', icon: 'none' })
        return
      }
      const dateStr = new Date().toISOString().slice(0, 10)
      this.writeShareFile(`账单_${dateStr}.csv`, csv)
    },

    onReminder() {
      wx.showToast({ title: '提醒设置即将开放', icon: 'none' })
    },

    onCurrency() {
      wx.navigateTo({ url: '/pages/currency-setting/currency-setting' })
    },

    onFeedback() {
      wx.showToast({ title: '欢迎通过评价反馈建议', icon: 'none' })
    },

    onAbout() {
      wx.showModal({
        title: '关于我们',
        content: '极简小帐专注于日常收支记录、预算管理、AI 记账和消费分析。',
        showCancel: false,
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
