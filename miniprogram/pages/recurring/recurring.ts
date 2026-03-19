import {
  getRecurringRules,
  deleteRecurringRule,
  updateRecurringRule,
} from '../../utils/storage'
import { IRecurringRule, fenToYuan } from '../../models/record'

const FREQ_LABELS: Record<string, string> = {
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
  yearly: '每年',
}

const DOW_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function buildFrequencyLabel(rule: IRecurringRule): string {
  switch (rule.frequency) {
    case 'daily': return '每天'
    case 'weekly': return `每${DOW_LABELS[rule.dayOfWeek ?? 1]}`
    case 'monthly': return `每月 ${rule.dayOfMonth ?? 1} 日`
    case 'yearly': return `每年 ${rule.monthOfYear ?? 1} 月 ${rule.dayOfMonth ?? 1} 日`
    default: return FREQ_LABELS[rule.frequency] || ''
  }
}

Component({
  data: {
    rules: [] as any[], // IRecurringRule & { amountYuan: string; frequencyLabel: string }
    totalCount: 0,
    activeCount: 0,
    pausedCount: 0,
  },

  pageLifetimes: {
    show() {
      this.loadRules()
    },
  },

  lifetimes: {
    attached() {
      this.loadRules()
    },
  },

  methods: {
    loadRules() {
      const rules = getRecurringRules()
      const enriched = rules.map(r => ({
        ...r,
        amountYuan: fenToYuan(r.amount),
        frequencyLabel: buildFrequencyLabel(r),
        statusText: r.enabled ? '已启用' : '已暂停',
      }))
      const activeCount = enriched.filter(rule => rule.enabled).length
      this.setData({
        rules: enriched,
        totalCount: enriched.length,
        activeCount,
        pausedCount: enriched.length - activeCount,
      })
    },

    onAddRule() {
      wx.navigateTo({ url: '/pages/recurring-form/recurring-form' })
    },

    onEditRule(e: WechatMiniprogram.TouchEvent) {
      const id = (e.currentTarget.dataset as any).id as string
      wx.navigateTo({ url: `/pages/recurring-form/recurring-form?id=${id}` })
    },

    onToggleRule(e: WechatMiniprogram.TouchEvent) {
      const id = (e.currentTarget.dataset as any).id as string
      const rules = getRecurringRules()
      const rule = rules.find(r => r.id === id)
      if (rule) {
        updateRecurringRule({ ...rule, enabled: !rule.enabled })
        this.loadRules()
      }
    },

    onDeleteRule(e: WechatMiniprogram.TouchEvent) {
      const id = (e.currentTarget.dataset as any).id as string
      const rule = getRecurringRules().find(r => r.id === id)
      if (!rule) return
      wx.showModal({
        title: '删除定期规则',
        content: `确认删除规则「${rule.name}」？\n已生成的草稿不受影响。`,
        confirmText: '删除规则',
        confirmColor: '#ff4757',
        success: (res) => {
          if (res.confirm) {
            deleteRecurringRule(id)
            this.loadRules()
          }
        },
      })
    },
  },
})
