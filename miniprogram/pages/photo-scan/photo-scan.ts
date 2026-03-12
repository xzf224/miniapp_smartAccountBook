import { parseOCRResult, parsedToRecord } from '../../utils/parser'
import { addRecordsBatch, getCategories } from '../../utils/storage'
import { CATEGORY_ICONS, yuanToFen, RecordType, RECORD_TYPES } from '../../models/record'

interface DraftRecord {
  tempId: number
  type: RecordType
  category: string
  amountYuan: string
  note: string
  date: string
  icon: string
  typeIndex: number
  categoryIndex: number
}

Component({
  data: {
    imagePath: '',
    scanning: false,
    drafts: [] as DraftRecord[],
    showResult: false,
    allTypes: RECORD_TYPES,
    allCategories: {} as Record<string, string[]>,
  },

  lifetimes: {
    attached() {
      const cats = getCategories()
      this.setData({ allCategories: cats as any })
    },
  },

  methods: {
    _pickImage(sourceType: ('album' | 'camera')[]) {
      if (this.data.scanning) return
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType,
        success: (res: WechatMiniprogram.ChooseMediaSuccessCallbackResult) => {
          const path = res.tempFiles[0].tempFilePath
          this.setData({ imagePath: path, showResult: false, drafts: [] })
        },
      })
    },

    onChooseFromAlbum() {
      this._pickImage(['album'])
    },

    onTakePhoto() {
      this._pickImage(['camera'])
    },

    onPreviewImage() {
      const { imagePath } = this.data
      if (!imagePath) return
      wx.previewImage({
        current: imagePath,
        urls: [imagePath],
      })
    },

    onStartScan() {
      if (!this.data.imagePath) {
        wx.showToast({ title: '请先选择图片', icon: 'none' })
        return
      }
      wx.showLoading({ title: '识别中…', mask: true })
      this.setData({ scanning: true })

      const cloudPath = `ocr_${Date.now()}.jpg`
      wx.cloud.uploadFile({
        cloudPath,
        filePath: this.data.imagePath,
        success: (uploadRes: any) => {
          wx.cloud.callFunction({
            name: 'ocr-receipt',
            data: { fileID: uploadRes.fileID },
            success: (callRes: any) => {
              wx.hideLoading()
              this.setData({ scanning: false })
              const result = callRes.result as any
              if (!result || !result.success) {
                wx.showToast({ title: '识别失败，请重试', icon: 'none' })
                return
              }
              const parsed = parseOCRResult(result.text || '')
              if (parsed.length === 0) {
                wx.showToast({ title: '未识别到费用数据', icon: 'none' })
                return
              }
              const cats = this.data.allCategories
              const drafts: DraftRecord[] = parsed.map((r, i) => {
                const typeCats: string[] = (cats as any)[r.type] || (cats as any)['支出'] || []
                const catIdx = typeCats.indexOf(r.category)
                return {
                  tempId: i,
                  type: r.type,
                  category: r.category,
                  amountYuan: (r.amount / 100).toFixed(2),
                  note: r.note,
                  date: r.date,
                  icon: CATEGORY_ICONS[r.category] || '他',
                  typeIndex: RECORD_TYPES.indexOf(r.type) >= 0 ? RECORD_TYPES.indexOf(r.type) : 0,
                  categoryIndex: catIdx >= 0 ? catIdx : 0,
                }
              })
              this.setData({ drafts, showResult: true })
            },
            fail: () => {
              wx.hideLoading()
              this.setData({ scanning: false })
              wx.showToast({ title: '云函数调用失败', icon: 'none' })
            },
          })
        },
        fail: () => {
          wx.hideLoading()
          this.setData({ scanning: false })
          wx.showToast({ title: '上传图片失败', icon: 'none' })
        },
      })
    },

    onEditAmount(e: WechatMiniprogram.Input) {
      const idx = (e.currentTarget.dataset as any).index as number
      const drafts = [...this.data.drafts]
      drafts[idx] = { ...drafts[idx], amountYuan: e.detail.value }
      this.setData({ drafts })
    },

    onEditNote(e: WechatMiniprogram.Input) {
      const idx = (e.currentTarget.dataset as any).index as number
      const drafts = [...this.data.drafts]
      drafts[idx] = { ...drafts[idx], note: e.detail.value }
      this.setData({ drafts })
    },

    onRemoveDraft(e: WechatMiniprogram.TouchEvent) {
      const idx = (e.currentTarget.dataset as any).index as number
      const drafts = this.data.drafts.filter((_: DraftRecord, i: number) => i !== idx)
      this.setData({ drafts, showResult: drafts.length > 0 })
    },

    onEditType(e: any) {
      const idx = (e.currentTarget.dataset as any).index as number
      const typeIdx = parseInt(e.detail.value)
      const newType = RECORD_TYPES[typeIdx] as RecordType
      const typeCats: string[] = (this.data.allCategories as any)[newType] || []
      const newCat = typeCats[0] || '其他'
      const drafts = [...this.data.drafts]
      drafts[idx] = {
        ...drafts[idx],
        type: newType,
        typeIndex: typeIdx,
        category: newCat,
        categoryIndex: 0,
        icon: CATEGORY_ICONS[newCat] || '他',
      }
      this.setData({ drafts })
    },

    onEditCategory(e: any) {
      const idx = (e.currentTarget.dataset as any).index as number
      const catIdx = parseInt(e.detail.value)
      const drafts = [...this.data.drafts]
      const type = drafts[idx].type
      const typeCats: string[] = (this.data.allCategories as any)[type] || []
      const newCat = typeCats[catIdx] || '其他'
      drafts[idx] = {
        ...drafts[idx],
        category: newCat,
        categoryIndex: catIdx,
        icon: CATEGORY_ICONS[newCat] || '他',
      }
      this.setData({ drafts })
    },

    onSaveAll() {
      const validDrafts = this.data.drafts.filter((d: DraftRecord) => {
        const amt = parseFloat(d.amountYuan)
        return d.category && !isNaN(amt) && amt > 0
      })
      if (validDrafts.length === 0) {
        wx.showToast({ title: '请检查金额是否正确', icon: 'none' })
        return
      }
      const records = validDrafts.map((d: DraftRecord) =>
        parsedToRecord({
          type: d.type,
          category: d.category,
          amount: yuanToFen(parseFloat(d.amountYuan)),
          note: d.note,
          date: d.date,
        }),
      )
      addRecordsBatch(records)
      wx.showToast({ title: `已保存 ${records.length} 条记录` })
      setTimeout(() => wx.navigateBack(), 600)
    },
  },
})
