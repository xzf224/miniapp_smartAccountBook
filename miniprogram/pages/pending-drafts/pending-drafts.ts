import {
  getPendingDrafts,
  savePendingDrafts,
  removePendingDraft,
  addRecord,
} from '../../utils/storage'
import { IPendingDraft as _IPendingDraft, IRecord, generateId, fenToYuan, yuanToFen } from '../../models/record'

Component({
  data: {
    drafts: [] as any[], // IPendingDraft & { editAmount: string; editNote: string }
  },

  lifetimes: {
    attached() {
      this.loadDrafts()
    },
  },

  pageLifetimes: {
    show() {
      this.loadDrafts()
    },
  },

  methods: {
    loadDrafts() {
      const drafts = getPendingDrafts()
      const draftsWithEdit = drafts.map(d => ({
        ...d,
        editAmount: fenToYuan(d.amount),
        editNote: d.note,
      }))
      this.setData({ drafts: draftsWithEdit })
    },

    onAmountInput(e: WechatMiniprogram.Input) {
      const idx = (e.currentTarget.dataset as any).index as number
      const drafts = this.data.drafts.slice()
      drafts[idx] = { ...drafts[idx], editAmount: e.detail.value }
      this.setData({ drafts })
    },

    onNoteInput(e: WechatMiniprogram.Input) {
      const idx = (e.currentTarget.dataset as any).index as number
      const drafts = this.data.drafts.slice()
      drafts[idx] = { ...drafts[idx], editNote: e.detail.value }
      this.setData({ drafts })
    },

    onConfirmDraft(e: WechatMiniprogram.TouchEvent) {
      const idx = (e.currentTarget.dataset as any).index as number
      const draft = this.data.drafts[idx]
      const amountNum = parseFloat(draft.editAmount)
      if (isNaN(amountNum) || amountNum <= 0) {
        wx.showToast({ title: '请输入正确金额', icon: 'none' })
        return
      }
      const now = Date.now()
      const record: IRecord = {
        id: generateId(),
        type: draft.type,
        category: draft.category,
        amount: yuanToFen(amountNum),
        date: draft.date,
        note: draft.editNote,
        createTime: now,
        updateTime: now,
      }
      addRecord(record)
      removePendingDraft(draft.id)
      wx.showToast({ title: '已入账', icon: 'success' })
      this.loadDrafts()
    },

    onIgnoreDraft(e: WechatMiniprogram.TouchEvent) {
      const idx = (e.currentTarget.dataset as any).index as number
      const draft = this.data.drafts[idx]
      wx.showModal({
        title: '忽略草稿',
        content: `忽略后"${draft.ruleName}"该笔草稿将被删除`,
        confirmText: '忽略',
        confirmColor: '#ff4757',
        success: (res) => {
          if (res.confirm) {
            removePendingDraft(draft.id)
            this.loadDrafts()
          }
        },
      })
    },

    onConfirmAll() {
      const { drafts } = this.data
      if (drafts.length === 0) return

      const now = Date.now()
      const toRemoveIds: string[] = []
      let successCount = 0

      for (const draft of drafts) {
        const amountNum = parseFloat(draft.editAmount)
        if (isNaN(amountNum) || amountNum <= 0) continue
        const record: IRecord = {
          id: generateId(),
          type: draft.type,
          category: draft.category,
          amount: yuanToFen(amountNum),
          date: draft.date,
          note: draft.editNote,
          createTime: now,
          updateTime: now,
        }
        addRecord(record)
        toRemoveIds.push(draft.id)
        successCount++
      }

      // 批量删除草稿
      if (toRemoveIds.length > 0) {
        const remaining = getPendingDrafts().filter(d => !toRemoveIds.includes(d.id))
        savePendingDrafts(remaining)
      }

      wx.showToast({ title: `${successCount} 条已入账`, icon: 'success' })
      this.loadDrafts()
    },
  },
})
