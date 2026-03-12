# 智能记账本（极简小帐） · Smart Account Book

> 一款基于微信小程序的智能记账工具，支持手动记账、语音识别记账、拍照扫描小票，并提供可视化消费统计与预算管理。

---

## 功能概览

| 模块 | 功能 |
|------|------|
| 📝 手动记账 | 选择收支类型、消费类别、输入金额、日期、备注，一键保存 |
| 🎙️ 语音记账 | 按住录音，百度 ASR 识别后自动解析多条记录，确认后批量保存 |
| 📷 拍照记账 | 拍摄或从相册选取小票，通过 OCR 云函数识别金额，生成草稿后确认保存 |
| 📊 消费统计 | 环形饼图展示消费构成，柱状图支持按日 / 周 / 月对比，类别排行 |
| 💰 预算管理 | 按类别或月总额设置支出预算，支持通用预算与按月精细化设置 |
| 🗂️ 类别管理 | 支出 / 收入 / 不计入收支三种类型，自由增删自定义类别 |
| 📤 数据导出 | 导出 UTF-8 BOM CSV（兼容 Excel / Numbers），通过系统分享面板转发或存档 |
| 🗑️ 数据清空 | 二次确认后一键清空全部记录 |

---

## 技术栈

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| 框架 | 微信小程序（原生） | 无第三方 UI 框架依赖 |
| 渲染器 | **Skyline** | `renderer: "skyline"`，高性能渲染 |
| 组件框架 | **glass-easel** | 全页面使用 `Component({})` 写法 |
| 语言 | **TypeScript**（严格模式） | `strict`, `noUnusedLocals`, `noUnusedParameters` |
| 图表 | 原生 **Canvas 2D** | 手绘饼图 + 柱状图，兼容 Skyline |
| 语音识别 | **百度 AI 语音识别 API** | PCM 16kHz，通过微信云函数隔离密钥 |
| OCR | **百度通用文字识别（高精度版）** | 通过微信云函数调用，密钥存于云端环境变量 |
| 本地存储 | `wx.setStorageSync` | 金额以「分」整数存储，避免浮点精度问题 |

---

## 项目结构

```
miniapp_smartAccountBook/
├── cloudfunctions/
│   ├── asr-voice/          # 语音识别云函数（百度 ASR，密钥由环境变量注入）
│   └── ocr-receipt/        # 小票 OCR 云函数（百度通用文字识别高精度版）
├── miniprogram/
│   ├── components/
│   │   ├── bar-chart/      # Canvas 2D 柱状图
│   │   ├── category-grid/  # 类别选择网格
│   │   ├── fab-button/     # 可拖拽悬浮操作按钮（FAB）
│   │   ├── navigation-bar/ # 自定义导航栏
│   │   ├── pie-chart/      # Canvas 2D 环形饼图
│   │   ├── record-item/    # 记录列表项
│   │   ├── summary-card/   # 收支汇总卡片
│   │   └── swipe-cell/     # 左滑删除组件
│   ├── models/
│   │   └── record.ts       # 数据模型、常量、工具函数
│   ├── pages/
│   │   ├── home/           # 记账首页（按日期分组列表）
│   │   ├── add-record/     # 新增 / 编辑记账
│   │   ├── voice-input/    # 语音录入页
│   │   ├── photo-scan/     # 拍照扫描页
│   │   ├── statistics/     # 消费统计页
│   │   ├── settings/       # 设置页（导出 / 清空 / 分享）
│   │   ├── budget-setting/ # 预算设置页
│   │   └── category-manage/# 类别管理页
│   └── utils/
│       ├── date.ts         # 日期工具函数
│       ├── parser.ts       # 语音 / OCR 文本解析（130+ 关键词映射）
│       ├── statistics.ts   # 统计计算（月度汇总、类别排行、对比数据）
│       └── storage.ts      # 本地存储 CRUD 封装
└── typings/                # 微信小程序类型声明
```

---

## 本地开发

### 前置条件

- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html) ≥ 1.06
- 微信基础库 ≥ 3.0.0（Skyline 渲染器）
- Node.js ≥ 18（仅用于 TypeScript 编译，开发者工具内置）

### 启动步骤

1. 克隆仓库，用微信开发者工具打开项目根目录
2. 在 `project.config.json` 中将 `appid` 替换为你自己的小程序 AppID
3. 在微信云开发控制台创建环境，更新 `miniprogram/app.ts` 中的 `env` 字段
4. 上传并部署云函数（右键 `cloudfunctions/asr-voice` 和 `cloudfunctions/ocr-receipt` → 「上传并部署：云端安装依赖」）
5. 在云开发控制台为两个云函数添加环境变量：

   | 变量名 | 说明 |
   |--------|------|
   | `BAIDU_API_KEY` | 百度 AI 开放平台 API Key |
   | `BAIDU_SECRET_KEY` | 百度 AI 开放平台 Secret Key |

6. 在微信公众平台 → 开发 → 开发设置 → 服务器域名中添加：
   - `https://aip.baidubce.com`
   - `https://vop.baidu.com`

### 开发者工具调试说明

语音识别在开发者工具中无法采集真实麦克风音频，已内置 mock 分支——`platform === 'devtools'` 时直接返回模拟文本，无需配置百度密钥即可调试解析逻辑。OCR 功能需真机或配置云函数后测试。

---

## 数据存储

所有数据存储于本地 `wx.setStorageSync`，单条记录约 200 字节，10 MB 上限约可存 50,000 条（日均 10 条可用约 13 年）。数据不上传至任何服务器。

| Storage Key | 类型 | 说明 |
|-------------|------|------|
| `records` | `IRecord[]` | 所有记账记录，按日期降序 |
| `categories` | `ICategories` | 用户自定义类别配置 |
| `budgets` | `IBudget[]` | 预算设置列表 |

---

## 已知问题 & 解决方案

| # | 问题 | 解决方案 |
|---|------|----------|
| 1 | `wx.translateVoice` 在基础库 3.x 已移除 | 改用百度 AI 语音识别 API（PCM 格式） |
| 2 | Skyline 中 `scroll-view` 高度不生效 | 外层 `page` 设 `flex-column + height:100vh`，`scroll-view` 设 `flex:1; height:0` |
| 3 | 微信 OCR `openapi.ocr` 101003 权限问题 | 改用百度通用文字识别（高精度版）云函数 |
| 4 | 导出后关闭分享面板误弹错误提示 | `fail` 回调中判断 `errMsg.includes('cancel')`，用户取消时静默处理 |
| 5 | 导出文件长期累积占用空间 | 写入新文件前清理 `USER_DATA_PATH` 下所有旧 `账单_*.csv` |

---

## v1.0 功能状态

- [x] 手动新增 / 编辑 / 删除记账
- [x] 语音识别记账（百度 ASR，云函数隔离密钥）
- [x] 拍照 OCR 识别小票（百度高精度版，云函数）
- [x] 消费统计（饼图 + 柱状图 + 类别排行）
- [x] 预算设置（按类别 + 总额，支持按月或通用）
- [x] 类别管理（自定义增删）
- [x] 数据导出（CSV，UTF-8 BOM）
- [x] 数据清空
- [ ] 记录搜索（v1.1 计划）
- [ ] 预算超支提醒（v1.1 计划）
- [ ] 多设备云同步（v2.0 计划）

---

## License

MIT
