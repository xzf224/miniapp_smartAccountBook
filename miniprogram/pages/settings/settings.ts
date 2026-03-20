import {
  exportBackupJSON,
  exportRecordsCSV,
  clearAllRecords,
  getBudgets,
  getCategories,
  getCurrencyCode,
  getPendingDrafts,
  getRecords,
  getReminderSettings,
  getRecurringRules,
  getUserProfile,
  restoreBackupJSON,
  saveUserProfile,
} from '../../utils/storage'

const LAST_BACKUP_AT_KEY = 'settings_last_backup_at'
const LAST_EXPORT_AT_KEY = 'settings_last_export_at'
const LAST_RESTORE_AT_KEY = 'settings_last_restore_at'
const LAST_FEEDBACK_AT_KEY = 'settings_last_feedback_at'

function formatActionStatus(rawValue: unknown, actionLabel: string, fallback: string): string {
  const timestamp = Number(rawValue)
  if (!Number.isFinite(timestamp) || timestamp <= 0) return fallback

  const target = new Date(timestamp)
  const now = new Date()
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime()
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const diffDays = Math.round((nowDay - targetDay) / (24 * 60 * 60 * 1000))

  if (diffDays <= 0) return `今天已${actionLabel}`
  if (diffDays === 1) return `昨天${actionLabel}`
  if (diffDays < 7) return `${diffDays} 天前${actionLabel}`
  return `${target.getMonth() + 1} 月 ${target.getDate()} 日${actionLabel}`
}

function formatLocalDateStamp(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

Component({
  data: {
    version: (getApp() as any).globalData.version as string,
    statRecords: 0,
    statTotalRecords: 0,
    statCategories: 0,
    statConsecutiveDays: 0,
    statTotalDays: 0,
    statBudgets: 0,
    statRules: 0,
    statPendingDrafts: 0,
    profileAvatarUrl: '',
    profileNickname: '',
    profilePersonalized: false,
    profileEditing: false,
    draftAvatarUrl: '',
    draftNickname: '',
    profileSummaryText: '',
    monthlySummaryText: '',
    monthlyFocusText: '',
    monthlyBudgetText: '',
    monthlyPendingText: '',
    monthlyRecurringText: '',
    reminderStatusText: '',
    reminderMetaText: '',
    recurringStatusText: '',
    recurringMetaText: '',
    categoryStatusText: '',
    categoryMetaText: '',
    currencyStatusText: '',
    currencyMetaText: '',
    backupStatusText: '',
    backupMetaText: '',
    exportStatusText: '',
    exportMetaText: '',
    restoreStatusText: '',
    restoreMetaText: '',
    aboutStatusText: '',
    aboutMetaText: '',
    feedbackStatusText: '',
    feedbackMetaText: '',
    dialogVisible: false,
    dialogMode: '',
    dialogTitle: '',
    dialogDesc: '',
    dialogConfirmText: '我知道了',
    dialogCancelText: '取消',
    dialogSingleAction: false,
    dialogDanger: false,
    pendingRestorePath: '',
    pendingRestoreFileName: '',
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
      const budgets = getBudgets()
      const recurringRules = getRecurringRules()
      const pendingDrafts = getPendingDrafts()
      const userProfile = getUserProfile()
      const reminderSettings = getReminderSettings()
      const currentCurrencyCode = getCurrencyCode()
      const now = new Date()
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const monthCount = records.filter((item: any) => item.date.startsWith(monthStr)).length
      const categoryCount = categories['支出'].length + categories['收入'].length
      const activeRuleCount = recurringRules.filter(rule => rule.enabled).length
      const activeReminderGroups = [
        reminderSettings.budgetAlertEnabled,
        reminderSettings.pendingDraftAlertEnabled,
      ].filter(Boolean).length

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

      const profileSummaryText = userProfile.personalized
        ? `已记录 ${records.length} 笔，连续记账 ${statConsecutiveDays} 天`
        : `已记录 ${records.length} 笔，点击右侧完善头像和昵称`
      const monthlySummaryText = monthCount > 0
        ? `本月已记 ${monthCount} 笔`
        : '本月还没有新记录'
      const monthlyFocusText = pendingDrafts.length > 0
        ? `有 ${pendingDrafts.length} 条待处理草稿`
        : '当前没有待处理草稿'
      const monthlyBudgetText = budgets.length > 0 ? `${budgets.length} 项预算配置` : '还没有设置预算'
      const monthlyPendingText = pendingDrafts.length > 0 ? `${pendingDrafts.length} 条待处理` : '当前清空'
      const monthlyRecurringText = recurringRules.length > 0 ? `${activeRuleCount}/${recurringRules.length} 条生效` : '尚未设置'
      const reminderStatusText = activeReminderGroups > 0 ? `已开启 ${activeReminderGroups} 组` : '全部关闭'
      const reminderMetaText = reminderSettings.budgetAlertEnabled || reminderSettings.pendingDraftAlertEnabled
        ? `预算提醒 ${reminderSettings.budgetAlertEnabled ? '开' : '关'}，草稿提醒 ${reminderSettings.pendingDraftAlertEnabled ? '开' : '关'}`
        : '建议至少开启一组重要提醒'
      const recurringStatusText = recurringRules.length > 0
        ? `${activeRuleCount}/${recurringRules.length} 条启用`
        : '未设置'
      const recurringMetaText = pendingDrafts.length > 0
        ? `${pendingDrafts.length} 条草稿待处理`
        : recurringRules.length > 0
          ? '固定收支会按规则自动生成'
          : '房租、工资、会员费都适合放这里'
      const categoryStatusText = `${categoryCount} 个分类`
      const categoryMetaText = `支出 ${categories['支出'].length} 个，收入 ${categories['收入'].length} 个`
      const currencyStatusText = `当前 ${currentCurrencyCode}`
      const currencyMetaText = '记账、预算和定期规则统一使用'
      const backupStatusText = formatActionStatus(wx.getStorageSync(LAST_BACKUP_AT_KEY), '生成备份', '建议先生成')
      const backupMetaText = '导出完整备份，适合迁移或保底保存'
      const exportStatusText = formatActionStatus(wx.getStorageSync(LAST_EXPORT_AT_KEY), '生成 CSV', '导出 CSV')
      const exportMetaText = '适合做表格分析或长期留存'
      const restoreStatusText = formatActionStatus(wx.getStorageSync(LAST_RESTORE_AT_KEY), '恢复', '从微信会话恢复')
      const restoreMetaText = '需先把备份文件发到微信会话，再选择恢复'
      const aboutStatusText = `版本 ${this.data.version}`
      const aboutMetaText = '产品介绍、版本信息与使用说明'
      const feedbackStatusText = formatActionStatus(wx.getStorageSync(LAST_FEEDBACK_AT_KEY), '提交反馈', '欢迎反馈建议')
      const feedbackMetaText = '功能建议、体验问题或 bug 都可以直接提交'

      this.setData({
        statRecords: monthCount,
        statTotalRecords: records.length,
        statCategories: categoryCount,
        statConsecutiveDays,
        statTotalDays,
        statBudgets: budgets.length,
        statRules: recurringRules.length,
        statPendingDrafts: pendingDrafts.length,
        profileAvatarUrl: userProfile.avatarUrl,
        profileNickname: userProfile.nickname,
        profilePersonalized: userProfile.personalized,
        draftAvatarUrl: userProfile.avatarUrl,
        draftNickname: userProfile.nickname,
        profileEditing: false,
        profileSummaryText,
        monthlySummaryText,
        monthlyFocusText,
        monthlyBudgetText,
        monthlyPendingText,
        monthlyRecurringText,
        reminderStatusText,
        reminderMetaText,
        recurringStatusText,
        recurringMetaText,
        categoryStatusText,
        categoryMetaText,
        currencyStatusText,
        currencyMetaText,
        backupStatusText,
        backupMetaText,
        exportStatusText,
        exportMetaText,
        restoreStatusText,
        restoreMetaText,
        aboutStatusText,
        aboutMetaText,
        feedbackStatusText,
        feedbackMetaText,
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

      this.setData({
        dialogVisible: true,
        dialogMode: 'profile-intro',
        dialogTitle: '开启个性化',
        dialogDesc: '设置头像和昵称后，我的页面会展示你的专属资料，信息仅保存在当前设备。',
        dialogConfirmText: '去设置',
        dialogCancelText: '稍后',
        dialogSingleAction: false,
        dialogDanger: false,
      })
    },

    closeDialog() {
      this.setData({
        dialogVisible: false,
        dialogMode: '',
        dialogTitle: '',
        dialogDesc: '',
        dialogConfirmText: '我知道了',
        dialogCancelText: '取消',
        dialogSingleAction: false,
        dialogDanger: false,
        pendingRestorePath: '',
        pendingRestoreFileName: '',
      })
    },

    onDialogMaskTap() {
      if (this.data.dialogSingleAction) return
      this.closeDialog()
    },

    onDialogCancel() {
      this.closeDialog()
    },

    onDialogConfirm() {
      const { dialogMode, pendingRestorePath } = this.data

      if (dialogMode === 'profile-intro') {
        this.setData({
          profileEditing: true,
          draftAvatarUrl: this.data.profileAvatarUrl,
          draftNickname: this.data.profileNickname,
        })
        this.closeDialog()
        return
      }

      if (dialogMode === 'restore-guide') {
        this.closeDialog()
        this.chooseRestoreFile()
        return
      }

      if (dialogMode === 'restore-confirm' && pendingRestorePath) {
        this.closeDialog()
        this.performRestore(pendingRestorePath)
        return
      }

      if (dialogMode === 'clear-all-confirm') {
        clearAllRecords()
        this.closeDialog()
        wx.showToast({ title: '已清空', icon: 'success' })
        this.loadStats()
        return
      }

      this.closeDialog()
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

    writeShareFile(fileName: string, content: string, actionKey?: string) {
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

      if (actionKey) {
        wx.setStorageSync(actionKey, Date.now())
      }

      ;(wx as any).shareFileMessage({
        filePath,
        fail: (err: any) => {
          const msg: string = (err && err.errMsg) || ''
          if (msg.includes('cancel')) return
          this.setData({
            dialogVisible: true,
            dialogMode: 'share-failed',
            dialogTitle: '文件已生成',
            dialogDesc: `分享面板打开失败，请升级微信后重试。\n文件已保存为 ${fileName}`,
            dialogConfirmText: '我知道了',
            dialogSingleAction: true,
            dialogDanger: false,
          })
        },
      })
    },

    onBackupData() {
      const backup = exportBackupJSON()
      const dateStr = formatLocalDateStamp(new Date())
      this.writeShareFile(`记账备份_${dateStr}.json`, backup, LAST_BACKUP_AT_KEY)
      this.loadStats()
    },

    chooseRestoreFile() {
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

          this.setData({
            dialogVisible: true,
            dialogMode: 'restore-confirm',
            dialogTitle: '确认恢复备份',
            dialogDesc: `即将恢复 ${file.name || '所选备份文件'}。\n当前账单、分类、预算、提醒与规则会被覆盖，建议先执行一次数据备份。`,
            dialogConfirmText: '确认恢复',
            dialogCancelText: '取消',
            dialogSingleAction: false,
            dialogDanger: true,
            pendingRestorePath: path,
            pendingRestoreFileName: file.name || '',
          })
        },
      })
    },

    onRestoreData() {
      this.setData({
        dialogVisible: true,
        dialogMode: 'restore-guide',
        dialogTitle: '从微信会话恢复',
        dialogDesc: '恢复会从微信会话里的备份文件中选择。\n请先把备份文件发送到文件传输助手或任意微信会话，再继续选择。',
        dialogConfirmText: '去选择文件',
        dialogCancelText: '取消',
        dialogSingleAction: false,
        dialogDanger: false,
      })
    },

    performRestore(path: string) {
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
            wx.setStorageSync(LAST_RESTORE_AT_KEY, Date.now())
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

    onExportData() {
      const csv = exportRecordsCSV()
      if (!csv) {
        wx.showToast({ title: '暂无记录可导出', icon: 'none' })
        return
      }
      const dateStr = formatLocalDateStamp(new Date())
      this.writeShareFile(`账单_${dateStr}.csv`, csv, LAST_EXPORT_AT_KEY)
      this.loadStats()
    },

    onReminder() {
      wx.navigateTo({ url: '/pages/reminder-setting/reminder-setting' })
    },

    onCurrency() {
      wx.navigateTo({ url: '/pages/currency-setting/currency-setting' })
    },

    onFeedback() {
      wx.navigateTo({ url: '/pages/feedback/feedback' })
    },

    onAbout() {
      wx.navigateTo({ url: '/pages/about/about' })
    },

    onClearAll() {
      this.setData({
        dialogVisible: true,
        dialogMode: 'clear-all-confirm',
        dialogTitle: '确认清空数据',
        dialogDesc: '将清空当前设备上的账单数据，此操作不可撤销。',
        dialogConfirmText: '确认清空',
        dialogCancelText: '取消',
        dialogSingleAction: false,
        dialogDanger: true,
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
