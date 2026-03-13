// app.ts
import { getCategories } from './utils/storage'
import { checkRecurringRules } from './utils/recurring'

App<IAppOption>({
  globalData: {
    version: 'v1.1.0',
  },
  onLaunch() {
    // 初始化类别数据（首次启动会写入默认值）
    getCategories()
    // 检查定期规则，生成待确认草稿
    checkRecurringRules()

    // 初始化云开发（OCR 功能依赖）
    if (wx.cloud) {
      wx.cloud.init({ traceUser: true })
    }
  },
})