import { DEFAULT_REMINDER_SETTINGS, getReminderSettings, saveReminderSettings } from '../../utils/storage'
import { clearBudgetAlertHistory } from '../../utils/budget-alert'

const BUDGET_THRESHOLD_OPTIONS = [70, 80, 90, 100]
const BUDGET_THRESHOLD_LABELS = ['70%', '80%', '90%', '100%']
const PENDING_DRAFT_THRESHOLD_OPTIONS = [1, 3, 5, 10]
const PENDING_DRAFT_THRESHOLD_LABELS = ['1 条', '3 条', '5 条', '10 条']

function getThresholdIndex(options: number[], value: number): number {
  const index = options.indexOf(value)
  return index >= 0 ? index : 0
}

Component({
  data: {
    budgetAlertEnabled: DEFAULT_REMINDER_SETTINGS.budgetAlertEnabled,
    budgetAlertThreshold: DEFAULT_REMINDER_SETTINGS.budgetAlertThreshold,
    budgetCategoryAlertEnabled: DEFAULT_REMINDER_SETTINGS.budgetCategoryAlertEnabled,
    budgetRepeatOverAlertEnabled: DEFAULT_REMINDER_SETTINGS.budgetRepeatOverAlertEnabled,
    pendingDraftAlertEnabled: DEFAULT_REMINDER_SETTINGS.pendingDraftAlertEnabled,
    pendingDraftAlertThreshold: DEFAULT_REMINDER_SETTINGS.pendingDraftAlertThreshold,
    budgetThresholdOptions: BUDGET_THRESHOLD_LABELS,
    budgetThresholdIndex: getThresholdIndex(BUDGET_THRESHOLD_OPTIONS, DEFAULT_REMINDER_SETTINGS.budgetAlertThreshold),
    pendingDraftThresholdOptions: PENDING_DRAFT_THRESHOLD_LABELS,
    pendingDraftThresholdIndex: getThresholdIndex(PENDING_DRAFT_THRESHOLD_OPTIONS, DEFAULT_REMINDER_SETTINGS.pendingDraftAlertThreshold),
    budgetSummaryText: '',
    pendingDraftSummaryText: '',
  },

  lifetimes: {
    attached() {
      this.loadSettings()
    },
  },

  methods: {
    buildViewState(settings: ReturnType<typeof getReminderSettings>) {
      const budgetSummaryText = settings.budgetAlertEnabled
        ? `${settings.budgetAlertThreshold}% · ${settings.budgetCategoryAlertEnabled ? '含分类' : '仅总预算'}${settings.budgetRepeatOverAlertEnabled ? ' · 超支重复提醒' : ''}`
        : '已关闭预算提醒'

      const pendingDraftSummaryText = settings.pendingDraftAlertEnabled
        ? `首页阈值 ${settings.pendingDraftAlertThreshold} 条`
        : '已关闭草稿提醒'

      return {
        budgetSummaryText,
        pendingDraftSummaryText,
      }
    },

    loadSettings() {
      const settings = getReminderSettings()
      this.setData({
        ...settings,
        budgetThresholdIndex: getThresholdIndex(BUDGET_THRESHOLD_OPTIONS, settings.budgetAlertThreshold),
        pendingDraftThresholdIndex: getThresholdIndex(PENDING_DRAFT_THRESHOLD_OPTIONS, settings.pendingDraftAlertThreshold),
        ...this.buildViewState(settings),
      })
    },

    syncSettings(partial: Record<string, any>) {
      const nextSettings = saveReminderSettings(partial)
      this.setData({
        ...nextSettings,
        budgetThresholdIndex: getThresholdIndex(BUDGET_THRESHOLD_OPTIONS, nextSettings.budgetAlertThreshold),
        pendingDraftThresholdIndex: getThresholdIndex(PENDING_DRAFT_THRESHOLD_OPTIONS, nextSettings.pendingDraftAlertThreshold),
        ...this.buildViewState(nextSettings),
      })
    },

    onBudgetAlertToggle(e: WechatMiniprogram.SwitchChange) {
      this.syncSettings({ budgetAlertEnabled: e.detail.value })
    },

    onBudgetThresholdChange(e: WechatMiniprogram.PickerChange) {
      const index = Number(e.detail.value)
      this.syncSettings({
        budgetAlertThreshold: BUDGET_THRESHOLD_OPTIONS[index] || DEFAULT_REMINDER_SETTINGS.budgetAlertThreshold,
      })
    },

    onBudgetCategoryAlertToggle(e: WechatMiniprogram.SwitchChange) {
      this.syncSettings({ budgetCategoryAlertEnabled: e.detail.value })
    },

    onBudgetRepeatOverAlertToggle(e: WechatMiniprogram.SwitchChange) {
      this.syncSettings({ budgetRepeatOverAlertEnabled: e.detail.value })
    },

    onPendingDraftAlertToggle(e: WechatMiniprogram.SwitchChange) {
      this.syncSettings({ pendingDraftAlertEnabled: e.detail.value })
    },

    onPendingDraftThresholdChange(e: WechatMiniprogram.PickerChange) {
      const index = Number(e.detail.value)
      this.syncSettings({
        pendingDraftAlertThreshold: PENDING_DRAFT_THRESHOLD_OPTIONS[index] || DEFAULT_REMINDER_SETTINGS.pendingDraftAlertThreshold,
      })
    },

    onResetHistory() {
      wx.showModal({
        title: '重置提醒历史',
        content: '重置后，预算相关提醒会重新开始计算，已提醒过的状态也可能再次出现。',
        confirmText: '重置',
        confirmColor: '#FF7D00',
        success: (res) => {
          if (!res.confirm) return
          clearBudgetAlertHistory()
          wx.showToast({ title: '已重置', icon: 'success' })
        },
      })
    },
  },
})
