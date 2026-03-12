import { parseVoiceText, parsedToRecord } from '../../utils/parser'
import { addRecordsBatch, getCategories } from '../../utils/storage'
import { RECORD_TYPES, RecordType, CATEGORY_ICONS, yuanToFen } from '../../models/record'

const recorderManager = wx.getRecorderManager()

interface DraftRecord {
  tempId: number
  type: RecordType
  typeIndex: number
  category: string
  categoryIndex: number
  amountYuan: string
  note: string
  date: string
  icon: string
}

Component({
  data: {
    isRecording: false,
    isTranslating: false,
    recognizedText: '',
    drafts: [] as DraftRecord[],
    showResult: false,
    allTypes: RECORD_TYPES,
    allCategories: {} as Record<string, string[]>,
  },

  lifetimes: {
    detached() {
      // 页面销毁时确保麦克风关闭（DevTools / 异常退出兜底）
      if (this.data.isRecording) {
        recorderManager.stop()
      }
    },

    attached() {
      const cats = getCategories()
      this.setData({ allCategories: cats as any })
      const self = this

      recorderManager.onStop((res: WechatMiniprogram.OnStopCallbackResult) => {
        self.setData({ isRecording: false, isTranslating: true })

        // 开发者工具无法录制真实音频，直接模拟识别结果
        if (wx.getSystemInfoSync().platform === 'devtools') {
          const mockText = '午餐30元，打车15块'
          self.setData({ isTranslating: false, recognizedText: mockText })
          self._parseText(mockText)
          wx.showToast({ title: '模拟识别（仅DevTools）', icon: 'none' })
          return
        }

        // 读取录音文件并转 base64，交由云函数持有密钥调用百度 ASR
        wx.getFileSystemManager().readFile({
          filePath: res.tempFilePath,
          encoding: 'base64',
          success: (fileRes: WechatMiniprogram.ReadFileSuccessCallbackResult) => {
            const base64Audio = fileRes.data as string
            // base64 解码后的原始字节数（百度 len 字段要求）
            const audioLen = Math.floor(base64Audio.length * 3 / 4) -
              (base64Audio.endsWith('==') ? 2 : base64Audio.endsWith('=') ? 1 : 0)

            wx.cloud.callFunction({
              name: 'asr-voice',
              data: { base64Audio, audioLen },
              success: (callRes: any) => {
                self.setData({ isTranslating: false })
                const result = callRes.result as any
                if (result && result.success) {
                  const text: string = result.text || ''
                  self.setData({ recognizedText: text })
                  if (text) self._parseText(text)
                  else wx.showToast({ title: '未识别到内容，请重试', icon: 'none' })
                } else {
                  console.error('ASR cloud error:', JSON.stringify(result))
                  wx.showToast({ title: '识别失败：' + (result && result.error ? result.error : '未知错误'), icon: 'none' })
                }
              },
              fail: (err: any) => {
                self.setData({ isTranslating: false })
                console.error('callFunction fail:', JSON.stringify(err))
                wx.showToast({ title: '云函数调用失败', icon: 'none' })
              },
            })
          },
          fail: (err: any) => {
            self.setData({ isTranslating: false })
            console.error('readFile fail:', JSON.stringify(err))
            wx.showToast({ title: '读取录音文件失败', icon: 'none' })
          },
        })
      })

      recorderManager.onError(() => {
        self.setData({ isRecording: false, isTranslating: false })
        wx.showToast({ title: '录音出错，请检查麦克风权限', icon: 'none' })
      })
    },
  },

  methods: {
    onStartRecord() {
      if (this.data.isRecording || this.data.isTranslating) return
      const self = this
      wx.authorize({
        scope: 'scope.record',
        success() {
          recorderManager.start({
            duration: 60000,
            sampleRate: 16000,
            numberOfChannels: 1,
            encodeBitRate: 48000,
            format: 'PCM',
          })
          self.setData({ isRecording: true, recognizedText: '', showResult: false, drafts: [] })
        },
        fail() {
          wx.showModal({
            title: '需要录音权限',
            content: '请前往设置开启录音权限后重试',
            confirmText: '去设置',
            success(res) {
              if (res.confirm) wx.openSetting()
            },
          })
        },
      })
    },

    onStopRecord() {
      if (!this.data.isRecording) return
      recorderManager.stop()
    },

    preventMove() {
      // 录音时阻止手指滑动触发滚动
    },

    _parseText(text: string) {
      const results = parseVoiceText(text)
      if (results.length === 0) {
        wx.showToast({ title: '未识别到有效记录', icon: 'none' })
        return
      }
      const { allCategories } = this.data
      const drafts: DraftRecord[] = results.map((r, i) => {
        const typeIdx = (RECORD_TYPES as string[]).indexOf(r.type as string)
        const catList: string[] = (allCategories as any)[r.type as string] || []
        const catIdx = catList.indexOf(r.category)
        return {
          tempId: i,
          type: r.type,
          typeIndex: typeIdx >= 0 ? typeIdx : 0,
          category: r.category,
          categoryIndex: catIdx >= 0 ? catIdx : 0,
          amountYuan: (r.amount / 100).toFixed(2),
          note: r.note,
          date: r.date,
          icon: CATEGORY_ICONS[r.category] || '他',
        }
      })
      this.setData({ drafts, showResult: true })
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

    onEditType(e: WechatMiniprogram.PickerChange) {
      const idx = (e.currentTarget.dataset as any).index as number
      const typeIndex = Number(e.detail.value)
      const { allCategories, drafts } = this.data
      const newType = RECORD_TYPES[typeIndex] as RecordType
      const catList: string[] = (allCategories as any)[newType as string] || []
      const newCategory = catList[0] || ''
      const drafts2 = [...drafts]
      drafts2[idx] = {
        ...drafts2[idx],
        type: newType,
        typeIndex,
        category: newCategory,
        categoryIndex: 0,
        icon: CATEGORY_ICONS[newCategory] || '他',
      }
      this.setData({ drafts: drafts2 })
    },

    onEditCategory(e: WechatMiniprogram.PickerChange) {
      const idx = (e.currentTarget.dataset as any).index as number
      const categoryIndex = Number(e.detail.value)
      const { allCategories, drafts } = this.data
      const catList: string[] = (allCategories as any)[drafts[idx].type as string] || []
      const newCategory = catList[categoryIndex] || ''
      const drafts2 = [...drafts]
      drafts2[idx] = {
        ...drafts2[idx],
        category: newCategory,
        categoryIndex,
        icon: CATEGORY_ICONS[newCategory] || '他',
      }
      this.setData({ drafts: drafts2 })
    },

    onEditDate(e: WechatMiniprogram.PickerChange) {
      const idx = (e.currentTarget.dataset as any).index as number
      const drafts = [...this.data.drafts]
      drafts[idx] = { ...drafts[idx], date: e.detail.value as string }
      this.setData({ drafts })
    },

    onRemoveDraft(e: WechatMiniprogram.TouchEvent) {
      const idx = (e.currentTarget.dataset as any).index as number
      const drafts = this.data.drafts.filter((_: DraftRecord, i: number) => i !== idx)
      this.setData({ drafts, showResult: drafts.length > 0 })
    },

    onSaveAll() {
      const { drafts } = this.data
      if (drafts.length === 0) return

      const validDrafts = drafts.filter((d: DraftRecord) => {
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
