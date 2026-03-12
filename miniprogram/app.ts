// app.ts
import { getCategories } from './utils/storage'

App<IAppOption>({
  globalData: {
    version: 'v1.0.0',
  },
  onLaunch() {
    // 初始化类别数据（首次启动会写入默认值）
    getCategories()

    // 初始化云开发（OCR 功能依赖）
    if (wx.cloud) {
      wx.cloud.init({ traceUser: true })
    }
  },
})