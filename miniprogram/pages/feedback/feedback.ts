const FEEDBACK_TYPES = ['功能建议', '体验问题', 'Bug 反馈', '其他']
const MAX_CONTENT_LENGTH = 500
const MAX_CONTACT_LENGTH = 60
const MIN_CONTENT_LENGTH = 5
const LAST_FEEDBACK_AT_KEY = 'settings_last_feedback_at'

function trimToLength(value: string, maxLength: number): string {
  return value.slice(0, maxLength)
}

Component({
  data: {
    version: (getApp() as any).globalData.version as string,
    feedbackTypes: FEEDBACK_TYPES,
    selectedType: FEEDBACK_TYPES[0],
    content: '',
    contact: '',
    submitting: false,
    maxContentLength: MAX_CONTENT_LENGTH,
    maxContactLength: MAX_CONTACT_LENGTH,
  },

  methods: {
    onTypeSelect(e: WechatMiniprogram.BaseEvent) {
      const type = String(e.currentTarget.dataset.type || FEEDBACK_TYPES[0])
      this.setData({ selectedType: type })
    },

    onContentInput(e: WechatMiniprogram.Input) {
      const content = trimToLength(e.detail.value.trimStart(), MAX_CONTENT_LENGTH)
      this.setData({ content })
    },

    onContactInput(e: WechatMiniprogram.Input) {
      const contact = trimToLength(e.detail.value.trim(), MAX_CONTACT_LENGTH)
      this.setData({ contact })
    },

    onSubmit() {
      if (this.data.submitting) return

      const content = this.data.content.trim()
      const contact = this.data.contact.trim()

      if (content.length < MIN_CONTENT_LENGTH) {
        wx.showToast({ title: `请至少填写 ${MIN_CONTENT_LENGTH} 个字`, icon: 'none' })
        return
      }

      if (!wx.cloud) {
        wx.showToast({ title: '当前环境不可用', icon: 'none' })
        return
      }

      const systemInfo = wx.getSystemInfoSync()

      this.setData({ submitting: true })
      wx.showLoading({ title: '提交中', mask: true })

      wx.cloud.callFunction({
        name: 'submit-feedback',
        data: {
          type: this.data.selectedType,
          content,
          contact,
          appVersion: this.data.version,
          clientInfo: {
            brand: systemInfo.brand || '',
            model: systemInfo.model || '',
            system: systemInfo.system || '',
            platform: systemInfo.platform || '',
            language: systemInfo.language || '',
            SDKVersion: systemInfo.SDKVersion || '',
            version: systemInfo.version || '',
          },
        },
        success: result => {
          const response = result.result as { success?: boolean; error?: string } | undefined
          if (!response?.success) {
            wx.showToast({ title: response?.error || '提交失败，请稍后重试', icon: 'none' })
            return
          }

          wx.setStorageSync(LAST_FEEDBACK_AT_KEY, Date.now())
          this.setData({
            content: '',
            contact: '',
          })
          wx.showToast({ title: '反馈已收到', icon: 'success' })
          setTimeout(() => {
            wx.navigateBack()
          }, 600)
        },
        fail: err => {
          const message = typeof err?.errMsg === 'string' && err.errMsg.includes('FunctionName parameter could not be found')
            ? '云函数未部署'
            : '提交失败，请稍后重试'
          wx.showToast({ title: message, icon: 'none' })
        },
        complete: () => {
          wx.hideLoading()
          this.setData({ submitting: false })
        },
      })
    },
  },
})
