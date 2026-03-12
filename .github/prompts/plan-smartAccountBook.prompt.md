# Plan: 智能记账本微信小程序

## TL;DR

基于现有 TypeScript 微信小程序项目（Skyline 渲染器 + Glass Easel 组件框架），开发智能记账本应用。数据使用本地存储 `wx.setStorageSync`，图表使用原生 Canvas 2D 手绘（避免 ec-canvas 与 Skyline 不兼容），语音识别使用 `RecorderManager`（PCM 格式录音）+ 百度 AI 语音识别 API（`wx.translateVoice` 已在新版基础库中废弃，改用百度 ASR），密钥通过微信云函数环境变量隔离（已落地）。小票 OCR 使用微信云开发云函数（已落地）。UI 采用微信原生风格。

### 现有项目特征（必须遵守）

- **渲染器**: Skyline（`renderer: "skyline"`），配置 `defaultDisplayBlock: true`, `defaultContentBox: true`
- **组件框架**: `glass-easel`（页面使用 `Component({})` 而非 `Page({})`）
- **导航栏**: 自定义（`navigationStyle: "custom"`），已有 `navigation-bar` 组件
- **TypeScript**: 严格模式（`strict: true`, `noUnusedLocals`, `noUnusedParameters` 等）
- **模块**: CommonJS，目标 ES2020
- **appid**: `wx2ccb2deaf98a37de`
- **tab 缩进**: 2 spaces

---

## 架构设计

### 数据模型

```typescript
// miniprogram/models/record.ts

/** 消费类型 */
type RecordType = '收入' | '支出' | '不计入收支'

/** 单条记账记录 */
interface IRecord {
  id: string               // 唯一ID: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  type: RecordType          // 消费类型
  category: string          // 消费类别（如"餐饮"、"工资"）
  amount: number            // 金额，单位：分（整数，避免浮点精度问题）
  date: string              // 日期 YYYY-MM-DD
  note: string              // 备注（可为空字符串）
  createTime: number        // 创建时间戳 ms
  updateTime: number        // 最后更新时间戳 ms
}

/** 按类型分组的类别配置 */
interface ICategories {
  '支出': string[]
  '收入': string[]
  '不计入收支': string[]
}

/** 单条预算设置 */
interface IBudget {
  year: number             // 年份
  month: number            // 月份 (1-12)，0 表示每月通用
  type: '支出' | '收入'   // 预算类型
  category: string         // 类别名，'__total__' 表示该类型总预算
  amount: number           // 预算金额，单位：分
}

/**
 * 类别图标方案说明
 *
 * 微信原生 <icon> 组件仅支持 9 种系统图标（success/info/warn/waiting/cancel/
 * download/search/clear/success_no_circle），不覆盖业务类别，因此不可用。
 *
 * 可选方案对比：
 *   ① Emoji（当前采用）
 *      优点：零资源开销，无需额外文件或 npm 包
 *      缺点：不同手机厂商的 Emoji 渲染风格略有差异（颜色/形状）
 *
 *   ② iconfont 字体图标（视觉统一时的升级路径）
 *      优点：矢量清晰、风格完全统一、可自定义颜色
 *      接入方式：
 *        1. 在 iconfont.cn 创建项目，添加所需图标，下载"字体文件"
 *        2. 将 iconfont.ttf 放入 miniprogram/fonts/，在 app.wxss 中声明：
 *             @font-face { font-family: 'iconfont'; src: url('./fonts/iconfont.ttf'); }
 *             .iconfont { font-family: 'iconfont'; }
 *        3. 将 CATEGORY_ICONS 的值改为 Unicode 码点字符串（如 '\ue001'）
 *        4. WXML 中用 <text class="iconfont">{{icon}}</text> 替代现有 <text>
 *      缺点：需维护字体文件，增加包体积约 50–200KB；用户自定义新类别时无图标
 *
 *   ③ WeUI mp-icon 组件
 *      优点：微信官方 WeUI 风格
 *      缺点：需引入 weui-miniprogram npm 包；图标种类有限，无餐饮/交通等业务图标
 *
 * 结论：v1.0 使用 Emoji，UI 验收后如需统一风格再迁移到 iconfont。
 * 用户自定义新类别时，若无对应 emoji，统一回退到 '📦'。
 */
const CATEGORY_ICONS: Record<string, string> = {
  // 支出
  '餐饮': '🍜', '交通': '🚗', '服饰': '👔', '购物': '🛒',
  '服务': '💈', '教育': '📚', '娱乐': '🎮', '运动': '⚽',
  '生活缴费': '💡', '旅行': '✈️', '宠物': '🐾', '医疗': '🏥',
  '保险': '🛡️', '公益': '❤️', '发红包': '🧧', '转账': '💸',
  '亲属卡': '💳', '其他人情': '🎁', '退还': '↩️','其他': '📦', 
  // 收入
  '工资': '💰', '奖金': '🏆', '兼职': '💼', '报销': '📋',
  '退款': '💵', '投资': '📈', '红包': '🧧',
  // 不计入收支
  '借入': '📥', '借出': '📤', '理财转入': '🏦',
  '理财转出': '🏧', '信用卡还款': '💳', '余额互转': '🔄',
}

/** 默认类别常量 */
const DEFAULT_CATEGORIES: ICategories = {
  '支出': [
    '餐饮', '交通', '服饰', '购物', '服务', '教育', '娱乐', '运动',
    '生活缴费', '旅行', '宠物', '医疗', '保险', '公益', '发红包', '转账',
    '亲属卡', '其他人情', '退还', '其他'
  ],
  '收入': ['', '奖金', '兼职', '报销', '退款', '投资', '红包', '其他'],
  '不计入收支': ['借入', '借出', '理财转入', '理财转出', '信用卡还款', '余额互转']
}
```

### 存储设计

| Storage Key | 类型 | 说明 |
|---|---|---|
| `records` | `IRecord[]` | 所有记账记录，按 `date` 降序 + `createTime` 降序 |
| `categories` | `ICategories` | 用户自定义类别（首次启动时从 `DEFAULT_CATEGORIES` 初始化） |
| `budgets` | `IBudget[]` | 预算设置列表，空数组表示未设置预算 |

**容量预估**: 单条记录约 200 bytes，10MB 上限可存约 50000 条，日均 10 条可用约 13 年。

### 页面结构

```
TabBar (3 tabs):
├── pages/home/home                    ← 记账首页（默认页）
├── pages/statistics/statistics        ← 消费统计
└── pages/settings/settings            ← 设置

Sub pages (navigateTo):
├── pages/add-record/add-record        ← 新增 / 编辑记账
├── pages/voice-input/voice-input      ← 语音录入（多记录批量）
├── pages/photo-scan/photo-scan        ← 拍照扫描小票（多记录批量）
├── pages/budget-setting/budget-setting  ← 预算设置
└── pages/category-manage/category-manage  ← 类别管理
```

### 第三方依赖

| 依赖 | 用途 | 集成方式 |
|---|---|---|
| `wx.getRecorderManager()` + 百度语音识别 API | 语音录制与识别 | PCM 格式录音，通过 `wx.request` 直接调用百度 ASR（密钥暂存前端，待迁移至云函数） |
| 微信云开发 | OCR 云函数 | `wx.cloud.init()` + `cloudfunctions/` 目录 |

> **⚠️ 已调整 — 语音识别方案变更**: `wx.translateVoice` 在新版基础库（3.x）运行时已被移除（`undefined is not a function`），无法使用。改为：
> 1. `RecorderManager.start({ format: 'PCM', sampleRate: 16000, ... })` 录音
> 2. 停止后 `FileSystemManager.readFile` 转 base64
> 3. `wx.request` 调用百度语音识别 API（`vop.baidu.com/server_api`，`dev_pid=1537` 普通话 16k）
> 4. 开发者工具中 PCM 无法录制真实音频，`platform === 'devtools'` 时直接返回模拟文本，不调用百度接口
>
> **待落地**: 百度 API Key/Secret Key 目前存放在前端代码中（安全风险），计划迁移至微信云函数（`cloudfunctions/asr-voice/`），前端只传 base64 音频，密钥在云端持有。

> **注意**: 不使用 ec-canvas/ECharts。Skyline 渲染器不兼容 ec-canvas 的 WebGL 模式，改用原生 Canvas 2D API 手绘饼图和柱状图。

### 组件架构

```
components/
├── navigation-bar/         ← 已有，所有页面复用
├── record-item/            ← 新建，单条记录展示（首页列表项）
├── category-grid/          ← 新建，类别选择网格（add-record 页使用）
├── month-picker/           ← 新建，月份前后切换器（首页 + 统计页复用）
├── summary-card/           ← 新建，收支汇总卡片（首页 + 统计页复用）
├── fab-button/             ← 新建，浮动操作按钮（首页使用）
├── pie-chart/              ← 新建，Canvas 2D 饼图（统计页使用）
├── bar-chart/              ← 新建，Canvas 2D 柱状图（统计页使用）
└── swipe-cell/             ← 新建，左滑操作（首页列表 + 类别管理复用）
```

### 工具模块架构

```
utils/
├── util.ts                 ← 已有，保留 formatTime
├── storage.ts              ← 新建，本地存储 CRUD 封装
├── date.ts                 ← 新建，日期工具函数
├── parser.ts               ← 新建，语音/OCR 文本解析
└── statistics.ts           ← 新建，统计计算函数

models/
└── record.ts               ← 新建，IRecord/ICategories 接口 + 常量
```

---

## 详细实现步骤

### Phase 1: 基础架构搭建

#### Step 1.1: 数据模型 — `miniprogram/models/record.ts`

**新建文件**。定义所有接口和常量，`export` 出去供其他模块使用。

```typescript
export type RecordType = '收入' | '支出' | '不计入收支'

export interface IRecord {
  id: string
  type: RecordType
  category: string
  amount: number       // 单位: 分
  date: string         // YYYY-MM-DD
  note: string
  createTime: number
  updateTime: number
}

export interface ICategories {
  '支出': string[]
  '收入': string[]
  '不计入收支': string[]
}

export const CATEGORY_ICONS: Record<string, string> = { /* 如上 */ }
export const DEFAULT_CATEGORIES: ICategories = { /* 如上 */ }
export const RECORD_TYPES: RecordType[] = ['支出', '收入', '不计入收支']

export interface IBudget {
  year: number
  month: number      // 0 = 每月通用
  type: '支出' | '收入'
  category: string   // '__total__' = 该类型总预算
  amount: number     // 分
}

// 金额工具
export function yuanToFen(yuan: number): number {
  return Math.round(yuan * 100)
}
export function fenToYuan(fen: number): string {
  return (fen / 100).toFixed(2)
}

// ID 生成
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
```

#### Step 1.2: 存储层 — `miniprogram/utils/storage.ts`

**新建文件**。所有对 `wx.getStorageSync` / `wx.setStorageSync` 的调用集中在此模块。

```typescript
import { IRecord, ICategories, DEFAULT_CATEGORIES } from '../models/record'

const RECORDS_KEY = 'records'
const CATEGORIES_KEY = 'categories'

// ---- 记录 CRUD ----
export function getRecords(): IRecord[] {
  return wx.getStorageSync(RECORDS_KEY) || []
}

export function saveRecords(records: IRecord[]): void {
  wx.setStorageSync(RECORDS_KEY, records)
}

export function addRecord(record: IRecord): void {
  const records = getRecords()
  records.unshift(record)  // 新记录插到头部
  saveRecords(records)
}

export function updateRecord(record: IRecord): void {
  const records = getRecords()
  const idx = records.findIndex(r => r.id === record.id)
  if (idx !== -1) {
    records[idx] = record
    saveRecords(records)
  }
}

export function deleteRecord(id: string): void {
  const records = getRecords().filter(r => r.id !== id)
  saveRecords(records)
}

export function addRecordsBatch(newRecords: IRecord[]): void {
  const records = getRecords()
  records.unshift(...newRecords)
  saveRecords(records)
}

export function clearAllRecords(): void {
  wx.removeStorageSync(RECORDS_KEY)
}

// ---- 类别 CRUD ----
export function getCategories(): ICategories {
  const cats = wx.getStorageSync(CATEGORIES_KEY)
  if (cats) return cats
  // 首次使用，初始化默认值
  wx.setStorageSync(CATEGORIES_KEY, DEFAULT_CATEGORIES)
  return { ...DEFAULT_CATEGORIES }  // 返回拷贝避免外部修改
}

export function saveCategories(categories: ICategories): void {
  wx.setStorageSync(CATEGORIES_KEY, categories)
}

export function addCategory(type: keyof ICategories, name: string): boolean {
  const cats = getCategories()
  if (cats[type].includes(name)) return false  // 已存在
  cats[type].push(name)
  saveCategories(cats)
  return true
}

export function deleteCategory(type: keyof ICategories, name: string): void {
  const cats = getCategories()
  cats[type] = cats[type].filter(c => c !== name)
  saveCategories(cats)
}

// ---- 预算 CRUD ----
const BUDGETS_KEY = 'budgets'

export function getBudgets(): IBudget[] {
  return wx.getStorageSync(BUDGETS_KEY) || []
}

export function saveBudgets(budgets: IBudget[]): void {
  wx.setStorageSync(BUDGETS_KEY, budgets)
}

export function upsertBudget(budget: IBudget): void {
  const budgets = getBudgets()
  const idx = budgets.findIndex(
    b => b.year === budget.year && b.month === budget.month
      && b.type === budget.type && b.category === budget.category
  )
  if (idx !== -1) budgets[idx] = budget
  else budgets.push(budget)
  saveBudgets(budgets)
}

export function deleteBudget(year: number, month: number, type: string, category: string): void {
  saveBudgets(getBudgets().filter(
    b => !(b.year === year && b.month === month && b.type === type && b.category === category)
  ))
}

/** 查询指定月份的预算（优先找精确月份，其次找 month=0 的通用预算） */
export function getBudgetAmount(year: number, month: number, type: '支出' | '收入', category: string): number {
  const budgets = getBudgets()
  const exact = budgets.find(b => b.year === year && b.month === month && b.type === type && b.category === category)
  if (exact) return exact.amount
  const universal = budgets.find(b => b.month === 0 && b.type === type && b.category === category)
  return universal ? universal.amount : 0
}

// ---- 导出 ----
export function exportRecordsCSV(): string {
  const records = getRecords()
  const header = '类型,类别,金额(元),日期,备注,创建时间'
  const rows = records.map(r =>
    `${r.type},${r.category},${(r.amount / 100).toFixed(2)},${r.date},"${r.note.replace(/"/g, '""')}",${new Date(r.createTime).toLocaleString()}`
  )
  return [header, ...rows].join('\n')
}
```

**关键点**:
- 所有写操作使用同步 API（`setStorageSync`），避免并发竞争
- `addRecordsBatch` 用于语音/OCR 批量保存场景
- `exportRecordsCSV` 的备注字段用双引号包裹，内部双引号转义为 `""`，防止 CSV 注入

#### Step 1.3: 日期工具 — `miniprogram/utils/date.ts`

**新建文件**。

```typescript
/** 获取今天日期字符串 YYYY-MM-DD */
export function getToday(): string { ... }

/** 格式化日期为 MM月DD日 周X */
export function formatDateDisplay(dateStr: string): string { ... }

/** 获取指定月份的起止日期 [startDate, endDate] */
export function getMonthRange(year: number, month: number): [string, string] { ... }

/** 获取指定日期所在周的起止日期 */
export function getWeekRange(dateStr: string): [string, string] { ... }

/** 获取指定月份的天数 */
export function getDaysInMonth(year: number, month: number): number { ... }

/** 将记录按日期分组，返回 [{date, dateDisplay, records, dayTotal}] */
export function groupRecordsByDate(records: IRecord[]): Array<{
  date: string
  dateDisplay: string
  records: IRecord[]
  dayIncome: number   // 当日收入合计（分）
  dayExpense: number  // 当日支出合计（分）
}> { ... }

/** 获取前N个月的 [year, month] 列表 */
export function getPreviousMonths(count: number): Array<[number, number]> { ... }
```

#### Step 1.4: 类型定义更新 — `typings/index.d.ts`

**修改现有文件**。移除旧的 `userInfo` 相关类型，保持简洁。

```typescript
/// <reference path="./types/index.d.ts" />

interface IAppOption {
  globalData: {}
}
```

> 无需额外类型声明。`RecorderManager` 和 `wx.translateVoice` 类型均已包含在标准 `typings/types/wx/` 中。

#### Step 1.5: 项目配置更新 — `miniprogram/app.json`

**修改现有文件**。完整 JSON 结构：

```json
{
  "pages": [
    "pages/home/home",
    "pages/statistics/statistics",
    "pages/settings/settings",
    "pages/add-record/add-record",
    "pages/voice-input/voice-input",
    "pages/photo-scan/photo-scan",
    "pages/budget-setting/budget-setting",
    "pages/category-manage/category-manage"
  ],
  "window": {
    "navigationBarTextStyle": "black",
    "navigationStyle": "custom"
  },
  "tabBar": {
    "color": "#999999",
    "selectedColor": "#1AAD19",
    "backgroundColor": "#ffffff",
    "borderStyle": "white",
    "list": [
      {
        "pagePath": "pages/home/home",
        "text": "记账",
        "iconPath": "images/tab-home.png",
        "selectedIconPath": "images/tab-home-active.png"
      },
      {
        "pagePath": "pages/statistics/statistics",
        "text": "统计",
        "iconPath": "images/tab-stats.png",
        "selectedIconPath": "images/tab-stats-active.png"
      },
      {
        "pagePath": "pages/settings/settings",
        "text": "设置",
        "iconPath": "images/tab-settings.png",
        "selectedIconPath": "images/tab-settings-active.png"
      }
    ]
  },
  "style": "v2",
  "renderer": "skyline",
  "rendererOptions": {
    "skyline": {
      "defaultDisplayBlock": true,
      "defaultContentBox": true,
      "tagNameStyleIsolation": "legacy",
      "disableABTest": true,
      "sdkVersionBegin": "3.0.0",
      "sdkVersionEnd": "15.255.255"
    }
  },
  "componentFramework": "glass-easel",
  "sitemapLocation": "sitemap.json",
  "lazyCodeLoading": "requiredComponents"
}
```

**注意**:
- tabBar 页面必须在 `pages` 数组中的前 3 位
- 旧页面 `pages/index/index` 和 `pages/logs/logs` 完全移除
- tabBar 图标文件必须是本地路径（不支持网络图片），81x81 px

#### Step 1.6: tabBar 图标 — `miniprogram/images/`

**新建 6 个 PNG 文件**（81x81 px，透明背景）：

| 文件名 | 说明 | 内容描述 |
|---|---|---|
| `tab-home.png` | 记账 tab 未选中 | 铅笔/记事本图标，灰色 #999 |
| `tab-home-active.png` | 记账 tab 选中 | 同上，绿色 #1AAD19 |
| `tab-stats.png` | 统计 tab 未选中 | 饼图/柱状图图标，灰色 |
| `tab-stats-active.png` | 统计 tab 选中 | 同上，绿色 |
| `tab-settings.png` | 设置 tab 未选中 | 齿轮图标，灰色 |
| `tab-settings-active.png` | 设置 tab 选中 | 同上，绿色 |

**实现方式**: 使用 Canvas 代码生成简单的 SVG 转 PNG，或从 iconfont 下载。如果生成图标困难，可先使用纯色占位图，后期替换。

#### Step 1.7: 全局入口更新 — `miniprogram/app.ts`

**修改现有文件**。移除旧的 logs 和 login 逻辑，初始化类别数据和云开发。

```typescript
// app.ts
import { getCategories } from './utils/storage'

App<IAppOption>({
  globalData: {},
  onLaunch() {
    // 初始化类别数据（首次启动会写入默认值）
    getCategories()

    // 初始化云开发（OCR 功能依赖，环境 ID 需替换）
    if (wx.cloud) {
      wx.cloud.init({
        traceUser: true,
        // env: 'your-env-id'  // TODO: 替换为实际云开发环境 ID
      })
    }
  },
})
```

#### Step 1.8: 全局样式 — `miniprogram/app.wxss`

**修改现有文件**。替换为记账本所需的全局样式。

```css
/* ====== CSS 变量 ====== */
page {
  --color-primary: #1AAD19;       /* 微信绿 */
  --color-danger: #FA5151;        /* 红色/支出 */
  --color-income: #1AAD19;        /* 绿色/收入 */
  --color-expense: #FA5151;       /* 红色/支出 */
  --color-neutral: #576B95;       /* 蓝灰色/不计入收支 */
  --color-text-primary: #353535;
  --color-text-secondary: #888888;
  --color-text-placeholder: #CCCCCC;
  --color-bg-page: #F6F6F6;
  --color-bg-card: #FFFFFF;
  --color-border: #EEEEEE;
  --radius-card: 16rpx;

  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue",
               "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 28rpx;
  color: var(--color-text-primary);
  background-color: var(--color-bg-page);
}

/* ====== 通用类 ====== */
.card {
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
  padding: 24rpx;
  margin: 0 24rpx 24rpx;
}

.section-title {
  font-size: 24rpx;
  color: var(--color-text-secondary);
  padding: 16rpx 24rpx;
}

.flex-row { display: flex; flex-direction: row; align-items: center; }
.flex-col { display: flex; flex-direction: column; }
.flex-1 { flex: 1; }
.text-center { text-align: center; }
.text-income { color: var(--color-income); }
.text-expense { color: var(--color-expense); }
.text-neutral { color: var(--color-neutral); }

/* ====== 页面安全区 ====== */
.safe-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}
```

#### Step 1.9: 云开发配置 — `project.config.json`

**修改现有文件**。添加 `cloudfunctionRoot` 字段。

```json
{
  "cloudfunctionRoot": "cloudfunctions/",
  // ... 其余配置保持不变
}
```

---

### Phase 2: 通用组件

#### Step 2.1: ~~月份切换组件~~ — ~~`miniprogram/components/month-picker/`~~ 【已调整 — 已删除】

> **调整说明**: `month-picker` 独立组件已被内联的日历图标方案替代。首页、统计页、预算设置页均使用 `<image src="/images/calendar.png" />` + `<picker>` 组合直接实现月份选择，不再有独立的 month-picker 组件。组件目录 `components/month-picker/` 已从代码库中删除，`home.json` 中的注册引用也已移除。

#### Step 2.2: 收支汇总卡片 — `miniprogram/components/summary-card/`

**新建 4 个文件**。

**功能**: 展示收入 / 支出 / 结余 三个数字。

```
Properties:
  income: string      // 收入金额 (已格式化的元)
  expense: string     // 支出金额
  balance: string     // 结余
```

**WXML 结构**:
```xml
<view class="summary-card card flex-row">
  <view class="item flex-col flex-1">
    <text class="label">收入</text>
    <text class="amount text-income">{{income}}</text>
  </view>
  <view class="item flex-col flex-1">
    <text class="label">支出</text>
    <text class="amount text-expense">{{expense}}</text>
  </view>
  <view class="item flex-col flex-1">
    <text class="label">结余</text>
    <text class="amount">{{balance}}</text>
  </view>
</view>
```

#### Step 2.3: 左滑操作组件 — `miniprogram/components/swipe-cell/`

**新建 4 个文件**。

**功能**: 包裹子内容，左滑露出右侧删除按钮。

```
Properties:
  (无，使用 slot 承载内容)

Events:
  delete: {}  // 删除按钮点击

Data:
  offsetX: number  // 当前偏移量

Methods:
  onTouchStart(e) — 记录起始 X
  onTouchMove(e) — 计算 deltaX，限制在 [最大左滑距离, 0]，实时 setData offsetX
  onTouchEnd(e) — 如果 deltaX 超过阈值，吸附到展开位置，否则回弹到 0
  onDelete() — triggerEvent('delete')
  close() — 回弹到 0（外部可调用）
```

**WXML 结构**:
```xml
<view class="swipe-cell">
  <view class="content" style="transform: translateX({{offsetX}}px)"
        bind:touchstart="onTouchStart" bind:touchmove="onTouchMove" bind:touchend="onTouchEnd">
    <slot></slot>
  </view>
  <view class="action-delete" bind:tap="onDelete">删除</view>
</view>
```

#### Step 2.4: 浮动操作按钮 — `miniprogram/components/fab-button/` 【已落地 + 新增拖拽功能】

**功能**: 右下角圆形 `+` 按钮，点击展开 3 个子选项（手动/语音/拍照），**支持拖拽移动，松开后自动吸附到左/右边缘**，子菜单弹出方向根据按钮位置动态调整（靠左弹右，靠右弹左；靠下弹上，靠上弹下）。

```
Data:
  expanded: boolean
  posRight: number    // 距右边缘距离（px）
  posBottom: number   // 距底部距离（px）
  popUp: boolean      // 子菜单是否向上弹出
  popLeft: boolean    // 子菜单是否向左弹出
  subStyle: string    // 子菜单 position:fixed 样式字符串

Methods:
  onTouchStart/Move/End — 拖拽逻辑，move < 5px 判定为 tap，触发 toggle
  _updateDirection()    — 根据按钮位置计算弹出方向和 subStyle
  toggle()              — 展开/收起子菜单
  onManual/Voice/Photo  — triggerEvent + toggle
```

**WXML 结构（已实现）**:
```xml
<view class="overlay" wx:if="{{expanded}}" bind:tap="onOverlayTap"></view>
<view class="sub-buttons {{popUp?'':'pop-down'}} {{popLeft?'pop-left':''}}" style="{{subStyle}}">
  <view class="sub-btn" bind:tap="onPhoto"><text class="sub-label">拍照记账</text></view>
  <view class="sub-btn" bind:tap="onVoice"><text class="sub-label">语音记账</text></view>
  <view class="sub-btn" bind:tap="onManual"><text class="sub-label">手动记账</text></view>
</view>
<view class="fab-container" style="right:{{posRight}}px; bottom:{{posBottom}}px;">
  <view class="fab-main" bind:touchstart="onTouchStart" catch:touchmove="onTouchMove" bind:touchend="onTouchEnd">+</view>
</view>
```

#### Step 2.5: 记录列表项组件 — `miniprogram/components/record-item/`

**新建 4 个文件**。

**功能**: 展示单条记账记录，包含类别 emoji、类别名、备注、金额。

```
Properties:
  record: Object  // IRecord 对象（WXML 中通过 Object 传递）

Computed (在 ts 中处理):
  icon: string        // CATEGORY_ICONS[record.category] || '📦'
  amountText: string  // fenToYuan(record.amount)
  colorClass: string  // 'text-expense' | 'text-income' | 'text-neutral'
  sign: string        // '+' | '-' | ''

Events:
  tap: { id: string }
```

**WXML 结构**:
```xml
<view class="record-item flex-row" bind:tap="onTap">
  <text class="icon">{{icon}}</text>
  <view class="info flex-col flex-1">
    <text class="category">{{record.category}}</text>
    <text class="note" wx:if="{{record.note}}">{{record.note}}</text>
  </view>
  <text class="amount {{colorClass}}">{{sign}}{{amountText}}</text>
</view>
```

#### Step 2.6: 类别选择网格 — `miniprogram/components/category-grid/`

**新建 4 个文件**。

**功能**: 将类别列表以 4 列网格展示，选中项高亮，每项显示 emoji + 文字。

```
Properties:
  categories: Array<string>   // 当前类型下的类别名列表
  selected: string            // 当前选中的类别名

Events:
  select: { category: string }
```

**WXML 结构**:
```xml
<view class="category-grid">
  <view class="grid-item {{item === selected ? 'active' : ''}}"
        wx:for="{{categoryItems}}" wx:key="name"
        bind:tap="onSelect" data-name="{{item.name}}">
    <text class="emoji">{{item.icon}}</text>
    <text class="name">{{item.name}}</text>
  </view>
</view>
```

**TS 逻辑**: `observers` 监听 `categories` 变化，将 `string[]` 映射为 `{ name, icon }[]`（从 `CATEGORY_ICONS` 查找）写入 `categoryItems` 数据。

#### Step 2.7: 饼图组件 — `miniprogram/components/pie-chart/`

**新建 4 个文件**。

**功能**: 使用原生 Canvas 2D API 绘制环形饼图，中心显示总金额。

```
Properties:
  data: Array<{ name: string, value: number, color: string }>  // 各类别数据
  total: string                                                  // 中心显示的总额文字

Methods:
  drawChart() — 在 Canvas 上绘制环形图
    - 使用 wx.createSelectorQuery() 获取 canvas 节点
    - canvas.getContext('2d') 获取 CanvasRenderingContext2D
    - 循环绘制 arc 扇形（环形用外圈弧 + 内圈留白实现）
    - 中心绘制 fillText 总额

Lifecycle:
  attached() → 延迟 100ms 后调用 drawChart()（确保节点渲染完毕）
  observers: 'data' → drawChart()  // 数据变化时重绘
```

**预定义 12 种颜色**: `['#5B8FF9', '#5AD8A6', '#5D7092', '#F6BD16', '#E86452', '#6DC8EC', '#945FB9', '#FF9845', '#1E9493', '#FF99C3', '#61DDAA', '#7262FD']`

**WXML**:
```xml
<view class="pie-chart-container">
  <canvas type="2d" id="pieChart" class="pie-canvas"></canvas>
</view>
```

#### Step 2.8: 柱状图组件 — `miniprogram/components/bar-chart/`

**新建 4 个文件**。

**功能**: 使用原生 Canvas 2D API 绘制柱状图。

```
Properties:
  data: Array<{ label: string, value: number }>  // X轴标签 + 值
  barColor: string                                // 柱子颜色，默认 '#5B8FF9'
  maxValue: number                                // Y轴最大值（可选，自动计算）

Methods:
  drawChart() — Canvas 2D 绘制
    - 计算坐标系: 留出左侧Y轴标签区域 + 底部X轴标签区域
    - 绘制Y轴网格线（4-5 条）
    - 绘制柱子（带圆角顶部）
    - 绘制X轴标签（如 "03/01", "第1周", "1月"）
    - 如柱子过多，X轴标签间隔显示
```

---

### Phase 3: 记账首页

#### Step 3.1: 首页 — `miniprogram/pages/home/`

**新建 4 个文件**: `home.json`, `home.ts`, `home.wxml`, `home.wxss`

**home.json** — 声明使用的组件：
```json
{
  "usingComponents": {
    "navigation-bar": "/components/navigation-bar/navigation-bar",
    "month-picker": "/components/month-picker/month-picker",
    "summary-card": "/components/summary-card/summary-card",
    "record-item": "/components/record-item/record-item",
    "swipe-cell": "/components/swipe-cell/swipe-cell",
    "fab-button": "/components/fab-button/fab-button"
  }
}
```

**home.ts** — Component 数据与方法：
```typescript
import { getRecords, deleteRecord } from '../../utils/storage'
import { groupRecordsByDate } from '../../utils/date'
import { fenToYuan } from '../../models/record'

Component({
  data: {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    income: '0.00',         // 当月收入（元）
    expense: '0.00',        // 当月支出（元）
    balance: '0.00',        // 当月结余（元）
    groups: [] as Array<{   // 按日期分组的记录
      date: string
      dateDisplay: string
      records: any[]
      dayIncome: number
      dayExpense: number
    }>,
    isEmpty: true,
  },

  lifetimes: {
    attached() { this.loadData() }
  },

  pageLifetimes: {
    show() { this.loadData() }   // 从 add-record 返回时刷新
  },

  methods: {
    loadData() {
      const { year, month } = this.data
      const allRecords = getRecords()
      // 筛选当月记录
      const monthStr = `${year}-${String(month).padStart(2, '0')}`
      const monthRecords = allRecords.filter(r => r.date.startsWith(monthStr))
      // 计算汇总
      let incomeTotal = 0, expenseTotal = 0
      monthRecords.forEach(r => {
        if (r.type === '收入') incomeTotal += r.amount
        else if (r.type === '支出') expenseTotal += r.amount
      })
      // 分组
      const groups = groupRecordsByDate(monthRecords)
      this.setData({
        income: fenToYuan(incomeTotal),
        expense: fenToYuan(expenseTotal),
        balance: fenToYuan(incomeTotal - expenseTotal),
        groups,
        isEmpty: monthRecords.length === 0,
      })
    },

    onMonthChange(e: any) {
      this.setData({ year: e.detail.year, month: e.detail.month })
      this.loadData()
    },

    onRecordTap(e: any) {
      const id = e.detail.id
      wx.navigateTo({ url: `/pages/add-record/add-record?id=${id}` })
    },

    onRecordDelete(e: any) {
      const id = e.currentTarget.dataset.id
      wx.showModal({
        title: '确认删除',
        content: '删除后不可恢复',
        success: (res) => {
          if (res.confirm) {
            deleteRecord(id)
            this.loadData()
          }
        }
      })
    },

    onManual()  { wx.navigateTo({ url: '/pages/add-record/add-record' }) },
    onVoice()   { wx.navigateTo({ url: '/pages/voice-input/voice-input' }) },
    onPhoto()   { wx.navigateTo({ url: '/pages/photo-scan/photo-scan' }) },
  }
})
```

**home.wxml** — 页面结构：
```xml
<navigation-bar title="智能记账本" back="{{false}}" />
<scroll-view scroll-y class="page-body">
  <month-picker year="{{year}}" month="{{month}}" bind:change="onMonthChange" />
  <summary-card income="{{income}}" expense="{{expense}}" balance="{{balance}}" />

  <!-- 空状态 -->
  <view class="empty-state" wx:if="{{isEmpty}}">
    <text class="empty-icon">📝</text>
    <text class="empty-text">暂无记录，点击下方按钮开始记账</text>
  </view>

  <!-- 记录列表 -->
  <view class="record-groups" wx:else>
    <view class="day-group" wx:for="{{groups}}" wx:key="date" wx:for-item="group">
      <view class="day-header flex-row">
        <text class="day-date">{{group.dateDisplay}}</text>
        <text class="day-summary">
          收入 {{group.dayIncomeText}} 支出 {{group.dayExpenseText}}
        </text>
      </view>
      <view wx:for="{{group.records}}" wx:key="id" wx:for-item="record">
        <swipe-cell bind:delete="onRecordDelete" data-id="{{record.id}}">
          <record-item record="{{record}}" bind:tap="onRecordTap" />
        </swipe-cell>
      </view>
    </view>
  </view>

  <!-- 底部间距，避免 FAB 遮挡最后一条记录 -->
  <view style="height: 160rpx;"></view>
</scroll-view>

<fab-button bind:manual="onManual" bind:voice="onVoice" bind:photo="onPhoto" />
```

**home.wxss** — 页面样式：
```css
.page-body {
  height: 100vh;
  background: var(--color-bg-page);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 200rpx;
}
.empty-icon { font-size: 80rpx; }
.empty-text { color: var(--color-text-secondary); margin-top: 24rpx; }

.day-header {
  padding: 20rpx 24rpx 8rpx;
  justify-content: space-between;
}
.day-date { font-size: 26rpx; color: var(--color-text-secondary); }
.day-summary { font-size: 22rpx; color: var(--color-text-placeholder); }
```

---

### Phase 4: 记账 CRUD

#### Step 4.1: 新增/编辑记账页 — `miniprogram/pages/add-record/`

**新建 4 个文件**。

**add-record.json**:
```json
{
  "usingComponents": {
    "navigation-bar": "/components/navigation-bar/navigation-bar",
    "category-grid": "/components/category-grid/category-grid"
  }
}
```

**add-record.ts** — 核心逻辑：
```typescript
import { getRecords, addRecord, updateRecord } from '../../utils/storage'
import { getCategories } from '../../utils/storage'
import { IRecord, RecordType, RECORD_TYPES, generateId, yuanToFen } from '../../models/record'
import { getToday } from '../../utils/date'

Component({
  data: {
    isEdit: false,            // 编辑模式
    recordId: '',             // 编辑时的记录 ID
    typeIndex: 0,             // 当前选中类型 index (0=支出, 1=收入, 2=不计入收支)
    types: RECORD_TYPES,
    categories: [] as string[], // 当前类型下的类别列表
    selectedCategory: '',
    amountText: '',           // 用户输入的金额文本（元）
    date: getToday(),
    note: '',
  },

  lifetimes: {
    attached() {
      // 检查是否编辑模式
      // 注意: glass-easel Component 获取页面参数需要通过 this.getOpenerEventChannel()
      // 或在 methods 中使用 getCurrentPages() 获取 options
    }
  },

  pageLifetimes: {
    show() {
      this.loadCategories()
      // 编辑模式下加载已有记录
      const pages = getCurrentPages()
      const currentPage = pages[pages.length - 1] as any
      const options = currentPage.options || {}
      if (options.id && !this.data.isEdit) {
        this.loadRecord(options.id)
      }
    }
  },

  methods: {
    loadCategories() {
      const cats = getCategories()
      const type = RECORD_TYPES[this.data.typeIndex]
      this.setData({ categories: cats[type] })
    },

    loadRecord(id: string) {
      const records = getRecords()
      const record = records.find(r => r.id === id)
      if (!record) return
      const typeIndex = RECORD_TYPES.indexOf(record.type as RecordType)
      this.setData({
        isEdit: true,
        recordId: id,
        typeIndex: typeIndex >= 0 ? typeIndex : 0,
        selectedCategory: record.category,
        amountText: (record.amount / 100).toString(),
        date: record.date,
        note: record.note,
      })
      this.loadCategories()
    },

    onTypeChange(e: any) {
      const idx = e.currentTarget.dataset.index
      this.setData({ typeIndex: idx, selectedCategory: '' })
      this.loadCategories()
    },

    onCategorySelect(e: any) {
      this.setData({ selectedCategory: e.detail.category })
    },

    onAmountInput(e: any) {
      this.setData({ amountText: e.detail.value })
    },

    onDateChange(e: any) {
      this.setData({ date: e.detail.value })
    },

    onNoteInput(e: any) {
      this.setData({ note: e.detail.value })
    },

    onSave() {
      const { selectedCategory, amountText, date, note, typeIndex, isEdit, recordId } = this.data
      // 校验
      if (!selectedCategory) { wx.showToast({ title: '请选择类别', icon: 'none' }); return }
      const amountNum = parseFloat(amountText)
      if (!amountText || isNaN(amountNum) || amountNum <= 0) {
        wx.showToast({ title: '请输入正确金额', icon: 'none' }); return
      }
      const type = RECORD_TYPES[typeIndex]
      const now = Date.now()
      const record: IRecord = {
        id: isEdit ? recordId : generateId(),
        type, category: selectedCategory,
        amount: yuanToFen(amountNum),
        date, note,
        createTime: isEdit ? (getRecords().find(r => r.id === recordId)?.createTime || now) : now,
        updateTime: now,
      }
      if (isEdit) {
        updateRecord(record)
        wx.showToast({ title: '已更新' })
      } else {
        addRecord(record)
        wx.showToast({ title: '已保存' })
      }
      setTimeout(() => wx.navigateBack(), 500)
    },
  }
})
```

**add-record.wxml** — 页面结构：
```xml
<navigation-bar title="{{isEdit ? '编辑记录' : '新增记录'}}" />
<view class="page-body">
  <!-- 类型 tabs -->
  <view class="type-tabs flex-row">
    <view class="type-tab {{typeIndex === index ? 'active' : ''}}"
          wx:for="{{types}}" wx:key="*this" data-index="{{index}}"
          bind:tap="onTypeChange">{{item}}</view>
  </view>

  <!-- 类别选择 -->
  <category-grid categories="{{categories}}" selected="{{selectedCategory}}"
                 bind:select="onCategorySelect" />

  <!-- 金额 -->
  <view class="form-row flex-row">
    <text class="label">¥</text>
    <input class="amount-input" type="digit" placeholder="0.00"
           value="{{amountText}}" bind:input="onAmountInput" />
  </view>

  <!-- 日期 -->
  <view class="form-row flex-row">
    <text class="label">日期</text>
    <picker mode="date" value="{{date}}" bind:change="onDateChange">
      <text>{{date}}</text>
    </picker>
  </view>

  <!-- 备注 -->
  <view class="form-row">
    <textarea class="note-input" placeholder="备注（可选）"
              value="{{note}}" bind:input="onNoteInput" maxlength="200" />
  </view>

  <!-- 保存 -->
  <view class="save-btn" bind:tap="onSave">保存</view>
</view>
```

---

### Phase 5: 语音记账

#### Step 5.1: 文本解析器 — `miniprogram/utils/parser.ts`

**新建文件**。

```typescript
import { ICategories, RecordType, DEFAULT_CATEGORIES, generateId, yuanToFen } from '../models/record'
import { getCategories } from './storage'
import { getToday } from './date'

interface ParsedRecord {
  type: RecordType
  category: string
  amount: number      // 分
  note: string
  date: string
}

/** 关键词到类别的映射 */
const KEYWORD_CATEGORY_MAP: Record<string, { type: RecordType, category: string }> = {
  // 支出
  '午餐': { type: '支出', category: '餐饮' },
  '早餐': { type: '支出', category: '餐饮' },
  '晚餐': { type: '支出', category: '餐饮' },
  '吃饭': { type: '支出', category: '餐饮' },
  '外卖': { type: '支出', category: '餐饮' },
  '咖啡': { type: '支出', category: '餐饮' },
  '奶茶': { type: '支出', category: '餐饮' },
  '水果': { type: '支出', category: '餐饮' },
  '打车': { type: '支出', category: '交通' },
  '地铁': { type: '支出', category: '交通' },
  '公交': { type: '支出', category: '交通' },
  '加油': { type: '支出', category: '交通' },
  '停车': { type: '支出', category: '交通' },
  '衣服': { type: '支出', category: '服饰' },
  '买衣': { type: '支出', category: '服饰' },
  '超市': { type: '支出', category: '购物' },
  '淘宝': { type: '支出', category: '购物' },
  '理发': { type: '支出', category: '服务' },
  '电影': { type: '支出', category: '娱乐' },
  '游戏': { type: '支出', category: '娱乐' },
  '电费': { type: '支出', category: '生活缴费' },
  '水费': { type: '支出', category: '生活缴费' },
  '房租': { type: '支出', category: '生活缴费' },
  '话费': { type: '支出', category: '生活缴费' },
  '看病': { type: '支出', category: '医疗' },
  '药': { type: '支出', category: '医疗' },
  '红包': { type: '支出', category: '发红包' },
  '转账': { type: '支出', category: '转账' },
  // 收入
  '工资': { type: '收入', category: '工资' },
  '奖金': { type: '收入', category: '奖金' },
  '报销': { type: '收入', category: '报销' },
  '退款': { type: '收入', category: '退款' },
}

/**
 * 解析语音识别文本，提取多条记录
 * 支持格式: "午餐30元，打车15块，买衣服200"
 */
export function parseVoiceText(text: string): ParsedRecord[] { ... }

/**
 * 解析 OCR 识别结果文本，提取购物小票中的商品和金额
 * 逐行扫描，匹配 "商品名 金额" 或 "商品名 x数量 金额" 等模式
 */
export function parseOCRResult(text: string): ParsedRecord[] { ... }
```

**`parseVoiceText` 核心逻辑**:
1. 以句号、逗号、分号分割文本为多段
2. 每段用正则 `/([\u4e00-\u9fa5]+)\s*(\d+(?:\.\d{1,2})?)\s*(?:元|块|¥)?/` 提取关键词和金额
3. 用 `KEYWORD_CATEGORY_MAP` 匹配关键词→类别
4. 未匹配到类别的记录标记为 `'其他'`
5. 返回 `ParsedRecord[]`

**`parseOCRResult` 核心逻辑（已优化）**:
1. 按换行分割文本
2. 用 6 组正则跳过汇总行、收银信息行、表头行（`合计`、`找零`、`收款`、`品名`、`数量`等），不再依赖行长度
3. 价格正则升级为 `¥?\s*(\d+(?:\.\d{1,2})?)\s*$`，支持整数价格（如"矿泉水 3"）
4. 商品名清洗：去掉末尾 `×2`、`x3`、`*5` 等数量标记
5. 用 `KEYWORD_CATEGORY_MAP` 对商品名推断类别（如"咖啡"→餐饮），未匹配归`购物`
6. 返回 `ParsedRecord[]`；类别和收支类型可在草稿页通过 picker 修改

#### Step 5.2: 语音录入页 — `miniprogram/pages/voice-input/`

**新建 4 个文件**。

**语音识别方案（已调整）**: ~~微信原生 `wx.translateVoice`~~ → **百度语音识别 API**（`wx.translateVoice` 在基础库 3.x 已被移除）。录音格式改为 PCM（16kHz 单声道），通过 `wx.request` 直接调用百度 ASR。开发者工具下返回模拟文本，跳过百度接口。

**voice-input.ts** — 核心逻辑（已实现）：
```typescript
import { parseVoiceText, parsedToRecord } from '../../utils/parser'
import { addRecordsBatch, getCategories } from '../../utils/storage'
import { RECORD_TYPES, RecordType, CATEGORY_ICONS, yuanToFen } from '../../models/record'

const BAIDU_API_KEY = '...'    // 密钥已迁移至云函数环境变量，前端不持有
// DevTools 下走 mock 分支，真机调用 wx.cloud.callFunction({ name: 'asr-voice' })
const recorderManager = wx.getRecorderManager()

Component({
  lifetimes: {
    attached() {
      recorderManager.onStop((res) => {
        // DevTools 分支：直接返回模拟结果
        if (wx.getSystemInfoSync().platform === 'devtools') {
          self._parseText('午餐30元，打车15块')
          return
        }
        // 真机分支：获取 token → readFile base64 → 调用百度 ASR
        wx.request({ url: `https://aip.baidubce.com/oauth/2.0/token?...`, method: 'GET',
          success: (tokenRes) => {
            wx.getFileSystemManager().readFile({ filePath: res.tempFilePath, encoding: 'base64',
              success: (fileRes) => {
                const audioLen = /* base64 解码字节数计算 */
                wx.request({
                  url: 'https://vop.baidu.com/server_api',
                  method: 'POST',
                  data: { format: 'pcm', rate: 16000, channel: 1, dev_pid: 1537,
                          token, speech: base64Audio, len: audioLen },
                  success: (r) => { if (r.data.err_no === 0) self._parseText(r.data.result[0]) }
                })
              }
            })
          }
        })
      })
    },
  },

  methods: {
    onStartRecord() {
      wx.authorize({ scope: 'scope.record', success() {
        recorderManager.start({ duration: 60000, sampleRate: 16000,
          numberOfChannels: 1, encodeBitRate: 48000, format: 'PCM' })
      }})
    },

    onStopRecord() {
      recorderManager.stop()
    },

    _parseText(text: string) {
      const results = parseVoiceText(text)
      if (results.length === 0) {
        wx.showToast({ title: '未识别到有效记录', icon: 'none' })
        return
      }
      const drafts: DraftRecord[] = results.map((r, i) => ({
        tempId: i,
        type: r.type,
        category: r.category,
        amountYuan: (r.amount / 100).toFixed(2),
        note: r.note,
        date: r.date,
        icon: CATEGORY_ICONS[r.category] || '📦',
      }))
      this.setData({ drafts, showResult: true })
    },

    onEditAmount(e: WechatMiniprogram.Input) { /* 修改 drafts[index].amountYuan */ },
    onEditNote(e: WechatMiniprogram.Input) { /* 修改 drafts[index].note */ },
    onRemoveDraft(e: WechatMiniprogram.TouchEvent) { /* 从 drafts 中移除指定项 */ },

    onSaveAll() {
      const { drafts } = this.data
      const records = drafts
        .filter(d => !isNaN(parseFloat(d.amountYuan)) && parseFloat(d.amountYuan) > 0)
        .map(d => parsedToRecord({
          type: d.type, category: d.category,
          amount: yuanToFen(parseFloat(d.amountYuan)),
          note: d.note, date: d.date,
        }))
      if (records.length === 0) {
        wx.showToast({ title: '请检查金额是否正确', icon: 'none' })
        return
      }
      addRecordsBatch(records)
      wx.showToast({ title: `已保存 ${records.length} 条记录` })
      setTimeout(() => wx.navigateBack(), 600)
    },
  },
})
```

**voice-input.wxml** — 页面结构：
```xml
<navigation-bar title="语音记账" />
<view class="page-body">
  <!-- 识别文本展示 -->
  <view class="text-area card">
    <text wx:if="{{recognizedText}}">{{recognizedText}}</text>
    <text wx:else class="placeholder">点击下方按钮，说出消费内容…</text>
  </view>

  <!-- 录音按钮 -->
  <view class="mic-btn {{isRecording ? 'recording' : ''}}"
        bind:tap="{{isRecording ? 'onStopRecord' : 'onStartRecord'}}">
    <text class="mic-icon">{{isRecording ? '⏹' : '🎙️'}}</text>
    <text class="mic-label">{{isRecording ? '停止录音' : '开始录音'}}</text>
  </view>

  <!-- 解析结果 -->
  <view class="result-section" wx:if="{{showResult}}">
    <view class="section-title">识别结果（可编辑）</view>
    <view class="draft-item card" wx:for="{{parsedRecords}}" wx:key="tempId">
      <view class="flex-row">
        <text class="draft-type">{{item.type}}</text>
        <text class="draft-category" bind:tap="onEditCategory"
              data-index="{{index}}">{{item.category}}</text>
        <view class="flex-1"></view>
        <text class="draft-remove" bind:tap="onRemoveRecord"
              data-index="{{index}}">✕</text>
      </view>
      <view class="flex-row" style="margin-top: 12rpx;">
        <text>¥</text>
        <input type="digit" value="{{item.amountYuan}}"
               bind:input="onEditAmount" data-index="{{index}}" />
        <input placeholder="备注" value="{{item.note}}"
               bind:input="onEditNote" data-index="{{index}}" />
      </view>
    </view>

    <view class="save-btn" bind:tap="onSaveAll">
      保存全部（{{parsedRecords.length}}条）
    </view>
  </view>
</view>
```

---

### Phase 6: 拍照记账 (OCR)

#### Step 6.1: OCR 云函数 — `cloudfunctions/ocr-receipt/`

**新建 2 个文件**:

**`cloudfunctions/ocr-receipt/package.json`**:
```json
{
  "name": "ocr-receipt",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  }
}
```

**`cloudfunctions/ocr-receipt/index.js`**:
```javascript
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event) => {
  const { fileID } = event
  try {
    // 下载文件获取 Buffer
    const fileRes = await cloud.downloadFile({ fileID })
    const buffer = fileRes.fileContent

    // 调用腾讯云 OCR — 通用印刷体识别
    const result = await cloud.openapi.ocr.printedText({
      imgUrl: '', // 不用 imgUrl
      img: buffer,
    })

    // 返回识别文本行
    return {
      success: true,
      items: result.items || [],
      text: (result.items || []).map(i => i.text).join('\n'),
    }
  } catch (err) {
    return { success: false, error: err.message || String(err) }
  }
}
```

**部署**: 需在微信开发者工具中右键 `cloudfunctions/ocr-receipt` → "上传并部署: 云端安装依赖"。

#### Step 6.2: 拍照扫描页 — `miniprogram/pages/photo-scan/`

**新建 4 个文件**。

**photo-scan.ts** — 核心流程：
```
methods:
  onChooseImage()
    → wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['camera', 'album'] })
    → 获取 tempFilePath
    → setData({ imagePath }) 预览图片

  onStartScan()
    → wx.showLoading('识别中…')
    → wx.cloud.uploadFile({ cloudPath, filePath }) 上传到云存储
    → wx.cloud.callFunction({ name: 'ocr-receipt', data: { fileID } }) 调用云函数
    → parseOCRResult(result.text) 解析结果
    → setData({ parsedRecords, showResult: true })
    → wx.hideLoading()

  onEditCategory / onEditAmount / onEditNote / onRemoveRecord
    → 同 voice-input 页逻辑

  onSaveAll()
    → 同 voice-input 页逻辑，调用 addRecordsBatch
```

**photo-scan.wxml** — 界面包含：
1. 图片预览区（自适应原图比例，`wx.getImageInfo` 动态计算高度）
2. "选择图片" / "重新选择" 按钮
3. "开始识别" 按钮
4. 识别结果草稿列表：每条包含收支类型 picker、类别 picker、金额输入、备注输入、删除按钮
5. "保存全部" 按钮

---

### Phase 7: 消费统计

#### Step 7.1: 统计计算模块 — `miniprogram/utils/statistics.ts`

**新建文件**。

```typescript
import { IRecord, RecordType, fenToYuan } from '../models/record'

/** 月度汇总 */
export interface MonthSummary {
  income: number    // 分
  expense: number
  balance: number
}

/** 类别排行项 */
export interface CategoryRankItem {
  category: string
  amount: number    // 分
  percentage: number // 0-100
  color: string
}

/** 计算月度收支汇总 */
export function calcMonthSummary(
  records: IRecord[], year: number, month: number, filterType?: RecordType
): MonthSummary { ... }

/** 计算类别排行（按金额降序），返回前 N 名 */
export function calcCategoryRanking(
  records: IRecord[], year: number, month: number, type: RecordType
): CategoryRankItem[] {
  // 1. 筛选当月 + 指定类型的记录
  // 2. 按类别 reduce 汇总 { category: totalAmount }
  // 3. 排序 descending
  // 4. 计算每项占比 = amount / totalAll * 100
  // 5. 分配颜色（CHART_COLORS 循环取色）
}

/** 每日对比数据（当月每天的金额） */
export function calcDailyComparison(
  records: IRecord[], year: number, month: number, type: RecordType
): Array<{ label: string, value: number }> {
  // 返回 [{label: '1', value: 3000}, {label: '2', value: 1500}, ...]
  // 天数由 getDaysInMonth 确定
}

/** 每周对比数据（近 4 周） */
export function calcWeeklyComparison(
  records: IRecord[], type: RecordType
): Array<{ label: string, value: number }> {
  // 返回 [{label: '2/24-3/2', value: 50000}, ...]
}

/** 每月对比数据（近 6 个月） */
export function calcMonthlyComparison(
  records: IRecord[], type: RecordType
): Array<{ label: string, value: number }> {
  // 返回 [{label: '10月', value: 200000}, {label: '11月', value: 180000}, ...]
}

/** 预定义图表颜色 */
export const CHART_COLORS = [
  '#5B8FF9', '#5AD8A6', '#5D7092', '#F6BD16', '#E86452',
  '#6DC8EC', '#945FB9', '#FF9845', '#1E9493', '#FF99C3',
  '#61DDAA', '#7262FD'
]
```

#### Step 7.2: 统计页面 — `miniprogram/pages/statistics/`

**新建 4 个文件**。

**statistics.json**:
```json
{
  "usingComponents": {
    "navigation-bar": "/components/navigation-bar/navigation-bar",
    "month-picker": "/components/month-picker/month-picker",
    "summary-card": "/components/summary-card/summary-card",
    "pie-chart": "/components/pie-chart/pie-chart",
    "bar-chart": "/components/bar-chart/bar-chart"
  }
}
```

**statistics.ts** — 核心数据：
```
data:
  year, month                        // 当前选中月份
  typeIndex: 0                       // 0=支出 1=收入 2=不计入收支
  income, expense, balance           // 汇总
  pieData: []                        // 饼图数据
  rankingList: []                    // 类别排行列表
  compareMode: 'daily'               // 'daily' | 'weekly' | 'monthly'
  barData: []                        // 柱状图数据
  barColor: string

methods:
  loadData()
    → getRecords() 获取全量数据
    → calcMonthSummary() 计算汇总
    → calcCategoryRanking() 计算排行 → 设置 pieData + rankingList
    → loadCompareData() 计算对比图表

  loadCompareData()
    → 根据 compareMode 调用 calcDailyComparison / calcWeeklyComparison / calcMonthlyComparison
    → setData({ barData })

  onMonthChange / onTypeChange / onCompareModeChange
    → setData + loadData
```

**statistics.wxml** — 页面结构：
```xml
<navigation-bar title="消费统计" back="{{false}}" />
<scroll-view scroll-y class="page-body">
  <month-picker year="{{year}}" month="{{month}}" bind:change="onMonthChange" />
  
  <!-- 类型 tabs -->
  <view class="type-tabs flex-row">
    <view class="type-tab ..." wx:for="{{['支出','收入','不计入收支']}}" ...>{{item}}</view>
  </view>

  <summary-card income="{{income}}" expense="{{expense}}" balance="{{balance}}" />

  <!-- 饼图区域 -->
  <view class="card" wx:if="{{pieData.length > 0}}">
    <view class="section-title">消费构成</view>
    <pie-chart data="{{pieData}}" total="{{typeTotalText}}" />
  </view>

  <!-- 类别排行 -->
  <view class="card" wx:if="{{rankingList.length > 0}}">
    <view class="section-title">类别排行</view>
    <view class="rank-item flex-row" wx:for="{{rankingList}}" wx:key="category">
      <text class="rank-no">{{index + 1}}</text>
      <text class="rank-name flex-1">{{item.category}}</text>
      <text class="rank-amount">¥{{item.amountText}}</text>
      <text class="rank-percent">{{item.percentage}}%</text>
    </view>
    <!-- 每项下方显示彩色进度条 -->
  </view>

  <!-- 对比视图 -->
  <view class="card">
    <view class="compare-tabs flex-row">
      <view bind:tap="onCompareModeChange" data-mode="daily" ...>每日</view>
      <view bind:tap="onCompareModeChange" data-mode="weekly" ...>每周</view>
      <view bind:tap="onCompareModeChange" data-mode="monthly" ...>每月</view>
    </view>
    <bar-chart data="{{barData}}" barColor="{{barColor}}" />
  </view>

  <view style="height: 40rpx;"></view>
</scroll-view>
```

---

### Phase 8: 设置

#### Step 8.1: 设置页面 — `miniprogram/pages/settings/`

**新建 4 个文件**。

**settings.ts** — 核心方法：
```
methods:
  onBudgetSetting()
    → wx.navigateTo({ url: '/pages/budget-setting/budget-setting' })

  onCategoryManage()
    → wx.navigateTo({ url: '/pages/category-manage/category-manage' })

  onExportData()
    → const csv = exportRecordsCSV()
    → 写入前先遍历 USER_DATA_PATH，删除所有旧的 `账单_*.csv`，避免长期累积占用空间
    → const filePath = `${wx.env.USER_DATA_PATH}/账单_${date}.csv`
    → wx.getFileSystemManager().writeFileSync(filePath, csv, 'utf8')（同步写，保持用户手势链）
    → wx.shareFileMessage({ filePath })
       - fail 回调：若 errMsg 含 'cancel'（用户主动关闭分享面板），静默 return，不弹任何提示
       - fail 回调：其他真正失败，降级显示 wx.showModal 提示升级微信

  onClearAll()
    → wx.showModal({ title: '确认清空', content: '此操作不可恢复...' })
    → if confirm: clearAllRecords(); wx.showToast({ title: '已清空' })

  onShareAppMessage()
    → return { title: '智能记账本 - 轻松管理日常收支', path: '/pages/home/home' }

  onShareTimeline()
    → return { title: '智能记账本' }
```

**settings.wxml**:
```xml
<navigation-bar title="设置" back="{{false}}" />
<view class="page-body">
  <view class="settings-group card">
    <view class="settings-item" bind:tap="onBudgetSetting">
      <text>预算设置</text><text class="arrow">›</text>
    </view>
    <view class="settings-item" bind:tap="onCategoryManage">
      <text>消费类别管理</text><text class="arrow">›</text>
    </view>
    <view class="settings-item" bind:tap="onExportData">
      <text>导出数据</text><text class="arrow">›</text>
    </view>
    <view class="settings-item" bind:tap="onClearAll">
      <text class="text-expense">清空所有记录</text><text class="arrow">›</text>
    </view>
  </view>
  <view class="settings-group card">
    <button class="share-btn" open-type="share">分享给好友</button>
  </view>
  <view class="version-text">v1.0.0</view>
</view>
```

#### Step 8.3: 预算设置页 — `miniprogram/pages/budget-setting/`

**新建 4 个文件**。

**budget-setting.json**:
```json
{
  "usingComponents": {
    "navigation-bar": "/components/navigation-bar/navigation-bar"
  }
}
```

**budget-setting.ts** — 核心逻辑：
```
data:
  typeIndex: 0                    // 0=支出 1=收入
  categories: string[]            // 当前类型的类别列表
  budgets: IBudget[]              // 当前已设置的预算
  useMonthly: boolean             // true=按月设置, false=通用（month=0）
  selectedYear: number
  selectedMonth: number

methods:
  loadData()
    → categories = getCategories()[currentType]
    → budgets = getBudgets().filter(b => b.type === currentType && matchMonthFilter)

  onSetBudget(e)
    → const { category } = e.currentTarget.dataset
    → const { amountText } = e.detail
    → upsertBudget({ year, month, type, category, amount: yuanToFen(parseFloat(amountText)) })
    → loadData()

  onClearBudget(e)
    → deleteBudget(year, month, type, category)
    → loadData()

  onSetTotal()
    → 设置 category='__total__' 的总预算（月总支出上限）
```

**budget-setting.wxml** — 页面结构：
```xml
<navigation-bar title="预算设置" />
<view class="page-body">
  <!-- 类型切换 -->
  <view class="type-tabs flex-row">
    <view class="type-tab {{typeIndex === 0 ? 'active' : ''}}" bind:tap="onTypeChange" data-index="0">支出预算</view>
    <view class="type-tab {{typeIndex === 1 ? 'active' : ''}}" bind:tap="onTypeChange" data-index="1">收入目标</view>
  </view>

  <!-- 通用/按月切换 -->
  <view class="setting-row flex-row card">
    <text>按月设置（不同月份不同预算）</text>
    <switch checked="{{useMonthly}}" bind:change="onUseMonthlyChange" />
  </view>
  <view class="month-row" wx:if="{{useMonthly}}">
    <month-picker year="{{selectedYear}}" month="{{selectedMonth}}" bind:change="onMonthChange" />
  </view>

  <!-- 总预算行 -->
  <view class="total-budget card flex-row">
    <text class="flex-1">月总预算上限</text>
    <input type="digit" placeholder="不限" value="{{totalBudgetText}}"
           bind:blur="onSetTotal" />
    <text>元</text>
  </view>

  <!-- 各类别预算列表 -->
  <view class="section-title">按类别设置预算</view>
  <view class="budget-item card flex-row" wx:for="{{categoryBudgets}}" wx:key="category">
    <text class="emoji">{{item.icon}}</text>
    <text class="name flex-1">{{item.category}}</text>
    <input type="digit" placeholder="不限" value="{{item.amountText}}"
           bind:blur="onSetBudget" data-category="{{item.category}}" />
    <text>元</text>
  </view>
</view>
```

**预算进度展示（summary-card 组件扩展）**:
- `summary-card` 新增可选 props: `expenseBudget: number`（支出总预算，分，0 表示未设置）
- 若 `expenseBudget > 0`，在支出金额下方显示进度条: `实际/预算`，超出时进度条变红
- WXSS 进度条: `width: {{(expense/expenseBudget * 100).toFixed(0)}}%`，max-width: 100%

**统计页预算集成**:
- 在 statistics.ts 的 `loadData()` 中调用 `getBudgetAmount()` 获取各类别预算
- 在类别排行列表的每项右侧显示「已用 X%（预算 Y 元）」，超预算标红
- 饼图 tooltip 中可附带预算对比（可选，复杂度高，v1.0 可简化为仅文字显示）

---

#### Step 8.2: 类别管理页 — `miniprogram/pages/category-manage/`

**新建 4 个文件**。

**category-manage.ts** — 核心逻辑：
```
data:
  typeIndex: 0
  types: RECORD_TYPES
  categories: string[]       // 当前类型下的类别列表
  newCategoryName: ''        // 新增输入框内容

methods:
  loadCategories()
    → this.setData({ categories: getCategories()[currentType] })

  onTypeChange(e)
    → setData typeIndex → loadCategories()

  onAddCategory()
    → 校验 newCategoryName 非空且不重复
    → addCategory(type, name)
    → loadCategories()
    → setData({ newCategoryName: '' })

  onDeleteCategory(e)
    → const name = e.currentTarget.dataset.name
    → wx.showModal({ title: '确认删除', content: `删除类别「${name}」？` })
    → if confirm: deleteCategory(type, name); loadCategories()
```

**category-manage.wxml**:
```xml
<navigation-bar title="类别管理" />
<view class="page-body">
  <view class="type-tabs flex-row">
    <view class="type-tab {{typeIndex === index ? 'active' : ''}}"
          wx:for="{{types}}" wx:key="*this" data-index="{{index}}"
          bind:tap="onTypeChange">{{item}}</view>
  </view>

  <!-- 类别列表 -->
  <view class="category-list">
    <swipe-cell wx:for="{{categories}}" wx:key="*this"
                bind:delete="onDeleteCategory" data-name="{{item}}">
      <view class="category-item flex-row">
        <text class="emoji">{{icons[item] || '📦'}}</text>
        <text class="name">{{item}}</text>
      </view>
    </swipe-cell>
  </view>

  <!-- 新增类别 -->
  <view class="add-row flex-row card">
    <input class="flex-1" placeholder="输入新类别名称" value="{{newCategoryName}}"
           bind:input="onInputChange" />
    <view class="add-btn" bind:tap="onAddCategory">添加</view>
  </view>
</view>
```

---

### Phase 9: 收尾

#### Step 9.1: 清理旧页面

1. **删除文件** (确认后):
   - `miniprogram/pages/index/index.ts`
   - `miniprogram/pages/index/index.wxml`
   - `miniprogram/pages/index/index.wxss`
   - `miniprogram/pages/index/index.json`
   - `miniprogram/pages/logs/logs.ts`
   - `miniprogram/pages/logs/logs.wxml`
   - `miniprogram/pages/logs/logs.wxss`
   - `miniprogram/pages/logs/logs.json`

2. 确认 `app.json` 的 `pages` 数组中已移除旧页面路径

#### Step 9.2: 页面间数据刷新策略

| 场景 | 触发 | 刷新方式 |
|---|---|---|
| add-record → home | 保存记录后 navigateBack | home 的 `pageLifetimes.show()` 调用 `loadData()` |
| voice-input → home | 批量保存后 navigateBack | 同上 |
| photo-scan → home | 批量保存后 navigateBack | 同上 |
| category-manage → add-record | 返回后类别可能已变 | add-record 的 `pageLifetimes.show()` 调用 `loadCategories()` |
| 切换到统计 tab | tabBar 点击 | statistics 的 `pageLifetimes.show()` 调用 `loadData()` |
| settings 清空数据 → home/stats | 下次切换 tab 时刷新 | `pageLifetimes.show()` |
| budget-setting → statistics | 返回统计页后预算进度需更新 | statistics 的 `pageLifetimes.show()` 调用 `loadData()`（同时重新查询 budgets） |
| budget-setting → home | 返回首页后汇总卡片预算进度需更新 | home 的 `pageLifetimes.show()` 重新加载并传入预算金额 |

#### Step 9.3: Skyline 兼容性检查

在所有页面和组件中:
- 不使用 `wx:if` 与 `slot` 的某些不兼容组合（Skyline 已知限制）
- `scroll-view` 必须设置显式高度（Skyline 不支持 auto height scroll-view）
- Canvas 2D 在 Skyline 下需使用 `<canvas type="2d">` 而非旧版 API
- Touch 事件在 Skyline 下行为与 WebView 一致，swipe-cell 无需特殊处理

---

## 完整文件清单

### 新建文件 (50+ 文件)

| # | 路径 | 说明 |
|---|------|------|
| 1 | `miniprogram/models/record.ts` | 接口、常量、工具函数 |
| 2 | `miniprogram/utils/storage.ts` | 本地存储 CRUD |
| 3 | `miniprogram/utils/date.ts` | 日期工具 |
| 4 | `miniprogram/utils/parser.ts` | 语音/OCR 文本解析 |
| 5 | `miniprogram/utils/statistics.ts` | 统计计算 |
| 6-9 | `miniprogram/components/month-picker/*` | 月份切换组件 (json/ts/wxml/wxss) |
| 10-13 | `miniprogram/components/summary-card/*` | 收支汇总卡片 (json/ts/wxml/wxss) |
| 14-17 | `miniprogram/components/swipe-cell/*` | 左滑操作组件 (json/ts/wxml/wxss) |
| 18-21 | `miniprogram/components/fab-button/*` | 浮动操作按钮 (json/ts/wxml/wxss) |
| 22-25 | `miniprogram/components/record-item/*` | 记录列表项 (json/ts/wxml/wxss) |
| 26-29 | `miniprogram/components/category-grid/*` | 类别选择网格 (json/ts/wxml/wxss) |
| 30-33 | `miniprogram/components/pie-chart/*` | 饼图 (json/ts/wxml/wxss) |
| 34-37 | `miniprogram/components/bar-chart/*` | 柱状图 (json/ts/wxml/wxss) |
| 38-41 | `miniprogram/pages/home/*` | 记账首页 (json/ts/wxml/wxss) |
| 42-45 | `miniprogram/pages/add-record/*` | 新增/编辑记账 (json/ts/wxml/wxss) |
| 46-49 | `miniprogram/pages/voice-input/*` | 语音录入 (json/ts/wxml/wxss) |
| 50-53 | `miniprogram/pages/photo-scan/*` | 拍照扫描 (json/ts/wxml/wxss) |
| 54-57 | `miniprogram/pages/statistics/*` | 消费统计 (json/ts/wxml/wxss) |
| 58-61 | `miniprogram/pages/settings/*` | 设置 (json/ts/wxml/wxss) |
| 62-65 | `miniprogram/pages/category-manage/*` | 类别管理 (json/ts/wxml/wxss) |
| 66-69 | `miniprogram/pages/budget-setting/*` | 预算设置 (json/ts/wxml/wxss) |
| 70-75 | `miniprogram/images/tab-*.png` | tabBar 图标 6 个 |
| 72-73 | `cloudfunctions/ocr-receipt/index.js + package.json` | OCR 云函数 |

### 修改文件 (5 文件)

| # | 路径 | 修改内容 |
|---|------|----------|
| 1 | `miniprogram/app.json` | 页面列表 + tabBar + plugins + 移除旧页面 |
| 2 | `miniprogram/app.ts` | 初始化类别 + 云开发 init + 移除旧逻辑 |
| 3 | `miniprogram/app.wxss` | CSS 变量 + 通用样式类（全量替换） |
| 4 | `typings/index.d.ts` | WechatSI 插件类型声明 + 移除 userInfo |
| 5 | `project.config.json` | 添加 `cloudfunctionRoot` |

### 删除文件 (8 文件)

| 路径 | 说明 |
|------|------|
| `miniprogram/pages/index/index.*` (4) | 旧首页 |
| `miniprogram/pages/logs/logs.*` (4) | 旧日志页 |

---

## 实施顺序与依赖

```
Phase 1 (基础) ──────────────────────────────────────────
  Step 1.1: models/record.ts           ← 无依赖
  Step 1.2: utils/storage.ts           ← 依赖 1.1
  Step 1.3: utils/date.ts              ← 依赖 1.1
  Step 1.4: typings/index.d.ts         ← 无依赖
  Step 1.5: app.json                   ← 无依赖（但需要 Phase 2-8 的页面路径确定）
  Step 1.6: tabBar 图标               ← 无依赖
  Step 1.7: app.ts                     ← 依赖 1.2
  Step 1.8: app.wxss                   ← 无依赖
  Step 1.9: project.config.json        ← 无依赖

Phase 2 (通用组件) ──────────────────────────────────────
  Step 2.1: month-picker               ← 无依赖
  Step 2.2: summary-card               ← 无依赖
  Step 2.3: swipe-cell                 ← 无依赖
  Step 2.4: fab-button                 ← 无依赖
  Step 2.5: record-item                ← 依赖 1.1 (CATEGORY_ICONS)
  Step 2.6: category-grid              ← 依赖 1.1 (CATEGORY_ICONS)
  Step 2.7: pie-chart                  ← 无依赖
  Step 2.8: bar-chart                  ← 无依赖

Phase 3 (首页) ──────────────────────────────────────────
  Step 3.1: pages/home                 ← 依赖 1.2, 1.3, 2.1-2.5

Phase 4 (CRUD) ──────────────────────────────────────────
  Step 4.1: pages/add-record           ← 依赖 1.1, 1.2, 1.3, 2.6

Phase 5 (语音) ──────────────────────────────────────────
  Step 5.1: utils/parser.ts            ← 依赖 1.1
  Step 5.2: pages/voice-input          ← 依赖 1.2, 5.1

Phase 6 (OCR) ───────────────────────────────────────────
  Step 6.1: cloudfunctions/ocr-receipt ← 无依赖（独立部署）
  Step 6.2: pages/photo-scan           ← 依赖 1.2, 5.1, 6.1

Phase 7 (统计) ──────────────────────────────────────────
  Step 7.1: utils/statistics.ts        ← 依赖 1.1
  Step 7.2: pages/statistics           ← 依赖 1.2, 1.3, 2.1, 2.2, 2.7, 2.8, 7.1

Phase 8 (设置) ──────────────────────────────────────────
  Step 8.1: pages/settings             ← 依赖 1.2
  Step 8.2: pages/category-manage      ← 依赖 1.1, 1.2, 2.3
  Step 8.3: pages/budget-setting       ← 依赖 1.1, 1.2 (IBudget + budget CRUD)

Phase 9 (收尾) ──────────────────────────────────────────
  Step 9.1: 清理旧页面                 ← 依赖 Phase 3 (确保新首页可用)
  Step 9.2: 数据刷新验证               ← 依赖所有页面完成
  Step 9.3: Skyline 兼容性检查         ← 依赖所有组件完成
```

---

## 验证步骤

| Phase | 验证内容 | 方法 |
|---|---|---|
| 1 | storage CRUD 正确 | 控制台手动调用 `getRecords()`, `addRecord()` 等验证 |
| 2 | 组件独立渲染正常 | 创建临时测试页引用每个组件，传入模拟数据 |
| 3 | 首页列表、月份切换、空状态 | 编译预览，手动添加几条模拟数据后刷新 |
| 4 | 新增→返回可见；编辑→保存更新；删除→确认移除 | 完整 CRUD 流程操作 |
| 5 | 语音录入→识别→解析→编辑→批量保存 | 真机测试（模拟器无麦克风） |
| 6 | 拍照→上传→OCR→解析→编辑→批量保存 | 真机测试 + 云开发环境已部署 |
| 7 | 饼图/柱状图渲染；切换月份/类型更新；排行排序 | 多月份、多类别数据验证 |
| 8 | 类别增删生效；CSV 导出格式正确；清空确认；分享 | 逐项功能测试 |
| 8.3 | 预算设置保存后首页/统计页预算进度条正确显示；超预算时高亮变红 | 设置预算后录入超额记录，验证进度条颜色和数值 |
| 全局 | tabBar 切换；页面间数据同步；1000+ 条性能 | 批量插入测试数据后全流程操作 |

---

## 决策与约束

| 决策 | 理由 |
|---|---|
| **本地存储** `wx.setStorageSync` | 简单可靠，无服务器依赖，10MB 上限足够个人使用 |
| **金额以「分」(整数) 存储** | 避免 JS 浮点精度问题（如 0.1+0.2≠0.3） |
| **原生 Canvas 2D 手绘图表**（非 ECharts） | Skyline 渲染器不兼容 ec-canvas WebGL；原生 Canvas 2D 体积更小，性能更好 |
| **`Component({})` 全部用组件写法** | 项目已配置 `glass-easel` + `lazyCodeLoading: requiredComponents`，现有页面均用 Component 写法 |
| **类别图标用 emoji** | 零资源开销，跨平台一致，用户直观易懂 |
| ~~**WechatSI 插件做语音识别**~~ → **百度 ASR** | WechatSI 需企业主体；`wx.translateVoice` 已从运行时移除；改用百度 AI 语音识别（50K 次/天免费），PCM 格式直传 base64 |
| **OCR 使用云开发云函数** | 安全（密钥在云端），免运维，有免费额度 |
| **语音/OCR 结果仅作草稿** | 准确率非 100%，必须让用户确认/编辑后再保存 |

### 排除范围（v1.0）

不包含：用户登录/注册、多设备同步、多币种、多账户、标签系统

### v2.0 路线图

| 功能 | 说明 | 主要依赖 |
|---|---|---|
| **账单提醒** | 微信订阅消息推送，指定时间提醒记账 | 需后端服务（云开发定时触发器）+ 微信公众平台申请订阅消息模板 |
| **多设备同步** | 数据云端存储，多手机共享账本 | 云数据库替换本地存储，需登录体系 |
| **预算报告** | 月度/年度预算执行报告，历史超标分析 | 依赖 v1.0 预算设置数据积累 |
| **标签系统** | 记录可打多个自定义标签，支持按标签筛选 | 数据模型扩展 + 筛选 UI |

---

## 问题与解决方案

| # | 问题 | 错误信息 | 根本原因 | 解决方案 |
|---|---|---|---|---|
| 1 | `wx.translateVoice` 不可用 | `undefined is not a function` | 微信基础库 3.x 已移除该 API | 改用百度语音识别 API，`wx.request` 直接调用 |
| 2 | 百度 token 接口 400 | HTTP 400 | 凭证须以 URL query 参数传递，不能放 POST body | 换为 GET 请求，凭证拼接在 URL 中 |
| 3 | 百度 ASR 错误 3311（rate invalid） | `err_no: 3311` | mp3 格式实际采样率与声明的 16000 不符，微信 mp3 编码器会重采样 | 改为 PCM 格式录音，实际采样率与声明一致 |
| 4 | 百度 ASR 错误 3300（speech error） | `err_no: 3300` | `len` 字段传了 `res.fileSize`，但 `RecorderManager.onStop` 回调没有该字段（`undefined`） | 从 base64 字符串长度计算原始字节数：`floor(b64.length * 3/4) - padding` |
| 5 | 百度 ASR 错误 3307（recognition error） | `err_no: 3307` | 开发者工具 PCM 录音无法采集真实麦克风音频，音频数据无效 | 增加 `platform === 'devtools'` 分支，直接返回模拟文本，真机走正常流程 |
| 6 | Skyline scroll-view 高度不生效 | 内容撑不满/无法滚动 | Skyline 中 scroll-view 需要明确高度约束 | 外层 `.page-root` 设 `height:100vh; flex-direction:column`，scroll-view 设 `flex:1; height:0` |
| 7 | 类别排序错乱（"其他"排在"退还"前） | — | `getCategories()` 直接返回 Storage 旧数据，顺序来自历史写入，不跟随 `DEFAULT_CATEGORIES` 更新 | `getCategories()` 每次调用都按 `DEFAULT_CATEGORIES` 顺序重建，user-added 追加在末尾 |
| 8 | WXML `\n` 真机不换行 | — | `<text>` 默认不解析 `\n`，真机与 DevTools 行为略有差异 | 将文本拆分为两个 `<text>` 置于 flex-column 的 `<view>` 中，100% 兼容 |
| 9 | navigation-bar 内存泄漏 | 性能警告 | `attached()` 中重复调用 `wx.getWindowInfo()` 三次 | 单次调用结果存入 `const info`，后续复用 |
| 10 | 分享面板关闭后弹出错误提示 | "文件写入成功，但分享面板打开失败" | `shareFileMessage` 的 `fail` 回调在用户主动关闭面板（cancel）时也会触发，与 API 不可用共用同一回调 | `fail` 中判断 `errMsg.includes('cancel')`，是则静默 return，否则才降级弹 Modal |
| 11 | 导出文件长期累积占用空间 | — | 每次导出写入带日期的新文件，旧文件保留在 USER_DATA_PATH 中不会自动清除 | 写入新文件前遍历目录，删除所有以 `账单_` 开头、`.csv` 结尾的旧文件 |

---

## 后续计划

### 近期待落地（v1.0 收尾）

| 优先级 | 任务 | 说明 |
|---|---|---|
| ✅ 已完成 | 将百度 API 密钥迁移至云函数 | 新建 `cloudfunctions/asr-voice/`，密钥通过云开发控制台环境变量（`BAIDU_API_KEY`/`BAIDU_SECRET_KEY`）注入，源码中使用 `process.env` 读取，不暴露任何密钥；前端读取录音 base64 后调用 `wx.cloud.callFunction({ name: 'asr-voice' })` |
| ✅ 已完成 | 添加服务器域名白名单 | 已在微信公众平台 → 开发 → 开发设置 → 服务器域名中添加 `aip.baidubce.com`、`vop.baidu.com` |
| ✅ 已完成 | 真机端对端测试语音识别 | 已在真机验证百度 ASR 全流程（录音 → base64 → ASR → 解析 → 草稿） |
| ✅ 已完成 | 完善 `parseVoiceText` 关键词覆盖率 | 关键词从约 30 个扩充至 130+ 个，覆盖餐饮（29）、交通（18）、服饰（10）、购物（18）、服务（9）、娱乐（19）、生活缴费（16）、医疗（12）、教育（9）、红包/转账（6）、收入（18）等场景 |
| ✅ 已完成 | OCR 识别优化 | `parseOCRResult` 全面重写：只输出 1 条记录（消费总额 + 商家名备注）；优先级实付 > 应付 > 合计/TOTAL > 小计/SUBTOTAL；支持 `$` 前缀金额；双行扫描（关键词和金额分两行的小票）；无合计行时累加明细；商家名扫描跳过 checkout/门店编号/邮编等干扰行；开启 `detect_direction=true` 方向自动校正 |
| ✅ 已完成 | 真机端对端测试 OCR | 切换为百度通用文字识别（高精度版）替代微信 `openapi.ocr`（101003 权限问题）；`ocr-receipt` 云函数使用 `process.env.BAIDU_API_KEY/BAIDU_SECRET_KEY` 环境变量；真机测试全流程（拍照 → 上传云存储 → 云函数 OCR → 解析草稿）验证通过 |
| ✅ 已完成 | 拍照记账页图片全屏预览 | 图片点击调用 `wx.previewImage`，支持双指捏合放大缩小 |
| ✅ 已完成 | 导出账单功能完善 | CSV 加 UTF-8 BOM（Excel/Numbers 中文不乱码）；`writeFileSync` 同步写文件后立即调用 `shareFileMessage`（保持用户手势链路）；文件名含日期（`账单_YYYY-MM-DD.csv`）；无记录时正确提示；写入前清理 USER_DATA_PATH 旧 `账单_*.csv` 文件防止累积；用户关闭分享面板（cancel）时静默不报错 |
| ✅ 已完成 | 版本号集中管理 | `app.ts` `globalData.version` 统一管理版本号，设置页从 `globalData` 读取，无需多处修改 |
| 🟢 低 | 删除 `voice-input.ts` 中的 devtools mock 分支 | 生产上线前移除调试代码（或改为构建时条件编译） |

### 中期功能（v1.1）

#### 🔴 高优先级

| 任务 | 说明 |
|---|---|
| **记录编辑** | ✅ 首页流水列表左滑显示"编辑"和"删除"操作按钮；点击编辑跳转至 `add-record` 页（传入 `recordId` 参数），支持修改类型、分类、金额、日期、备注 |
| **搜索 / 筛选** | 新增搜索入口（首页顶部），支持按备注关键词、分类、金额区间、日期区间筛选，结果高亮匹配词 |
| **云同步** | 使用微信云开发 CloudDB（`db.collection('records')`），本地 Storage 作缓存层，保证离线可用；登录即同步，换手机不丢数据 |
| **周期性记账** | 支持"重复账单"规则（每月/每周），到期自动添加草稿提醒，用于房租、话费、会员费等固定支出 |

#### 🟡 中优先级

| 任务 | 说明 |
|---|---|
| **预算超支提醒** | 首页 `summary-card` 超出预算时红色高亮；当月某分类快触线（≥80%）时推送微信订阅消息 |
| **账单图片附件** | 手动添加记录时可拍照/选图附上小票（存云存储），不局限于 OCR 识别流程 |
| **多账本** | 支持创建"家庭"、"出差"等独立账本，互相隔离；底部 TabBar 或首页顶部切换 |
| **年度账单报告** | 年末生成可分享的年度消费报告卡片（含总支出、最大消费类别、月均消费等），支持截图分享 |
| **资产概览** | 新增"资产"tab 或卡片，支持录入账户余额（现金、支付宝、银行卡），显示净资产 |

#### 🟢 低优先级

| 任务 | 说明 |
|---|---|
| **CSV/Excel 导入** | 支持导入支付宝/微信账单 CSV，自动匹配分类，补录历史记录 |
| **分账功能** | AA 制消费记录，生成分享链接，跟踪还款状态 |
| ✅ **数据导出** | 已完成：生成 CSV 带 BOM，`shareFileMessage` 分享，文件名含日期 |

### 长期路线（v2.0）

见上方 v2.0 路线图。
