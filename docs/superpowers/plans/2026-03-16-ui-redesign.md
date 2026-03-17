# UI 全面改版 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将微信小程序所有页面从绿色主题改为橙色主题，结构对齐 `pencil/account_book_new.pen` 设计稿，保留定期账单等全部业务逻辑。

**Architecture:** 先更新 `app.wxss` 全局 CSS 变量生效橙色主题，再逐个更新各页面 wxml/wxss。**TS 文件变更仅限以下三处**：`summary-card.ts`（添加 daysLeft property）、`home.ts`（添加 daysLeft 和 analysisItems 计算）、`app.json`（注册 category-form 页面）。其余所有 .ts 文件不做修改。

**Tech Stack:** 微信小程序 WXML/WXSS，Skyline 渲染器，glass-easel 组件框架

**Spec:** `docs/superpowers/specs/2026-03-16-ui-redesign-design.md`

---

## Chunk 1: 全局基础 & 组件

### Task 1: 更新 app.wxss 全局 CSS 变量

**Files:**
- Modify: `miniprogram/app.wxss`

当前 `--color-primary` 是绿色 `#1AAD19`，`--radius-card` 是 `0rpx`，`--color-bg-page` 是白色。需要全部更新为橙色设计体系。

- [ ] **Step 1: 更新 app.wxss**

将 `miniprogram/app.wxss` 的 `:root / page` 部分替换为：

```css
page {
  --color-primary: #FF7D00;
  --color-primary-light: #FFF3E0;
  --color-primary-gradient-start: #FF9500;
  --color-primary-gradient-end: #FF7D00;
  --color-danger: #FA5151;      /* kept from original */
  --color-income: #4CAF50;
  --color-expense: #FA5151;
  --color-neutral: #576B95;    /* kept from original */
  --color-text-primary: #1a1a1a;
  --color-text-secondary: #999999;
  --color-text-placeholder: #C8C8C8;
  --color-bg-page: #F5F5F5;
  --color-bg-card: #FFFFFF;
  --color-border: #EFEFEF;
  --radius-card: 24rpx;
  --radius-btn: 44rpx;

  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue",
               "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 28rpx;
  color: var(--color-text-primary);
  background-color: var(--color-bg-page);
}
```

同时更新 `.save-btn` 使用新主色：
```css
.save-btn {
  margin: 40rpx 32rpx 0;
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  border-radius: var(--radius-btn);
  background: var(--color-primary);
  color: #fff;
  font-size: 32rpx;
  font-weight: 600;
  letter-spacing: 2rpx;
}
```

并新增通用工具类：
```css
/* ====== 通用卡片 ====== */
.card {
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
  margin: 0 24rpx 16rpx;
  padding: 32rpx;
}

/* ====== 通用菜单组 ====== */
.menu-group {
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
  margin: 0 24rpx 16rpx;
  overflow: hidden;
}

.menu-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 28rpx 32rpx;
  min-height: 100rpx;
  box-sizing: border-box;
}

.menu-item-icon {
  width: 40rpx;
  height: 40rpx;
  margin-right: 24rpx;
  flex-shrink: 0;
}

.menu-item-label {
  flex: 1;
  font-size: 28rpx;
  color: var(--color-text-primary);
}

.menu-item-arrow {
  font-size: 32rpx;
  color: #C8C8C8;
}
```

- [ ] **Step 2: Commit**

```bash
git add miniprogram/app.wxss
git commit -m "style: update global CSS vars to orange theme"
```

---

### Task 2: 更新 bottom-nav 组件样式（使用 CSS 变量）

**Files:**
- Modify: `miniprogram/components/bottom-nav/bottom-nav.wxss`

当前 bottom-nav 已有橙色视觉效果，但使用了硬编码颜色值（`#ff9500`、`#ff8400`）。需要改为 CSS 变量，并按设计稿调整尺寸。

- [ ] **Step 1: 更新 bottom-nav.wxss**

```css
:host {
  display: block;
}

.bottom-nav-shell {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
  background: transparent;
}

.bottom-nav-top-line {
  height: 16rpx;
  background: linear-gradient(180deg, rgba(245, 245, 245, 0), rgba(245, 245, 245, 0.9));
}

.bottom-nav {
  display: flex;
  align-items: flex-end;
  height: calc(100rpx + env(safe-area-inset-bottom));
  padding: 0 8rpx env(safe-area-inset-bottom);
  background: #ffffff;
  border-top: 1rpx solid var(--color-border);
  box-sizing: border-box;
}

.bottom-nav-item {
  flex: 1;
  height: 90rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.bottom-nav-item-center {
  justify-content: flex-start;
  transform: translateY(-6rpx);
}

.bottom-nav-icon {
  width: 44rpx;
  height: 44rpx;
}

.bottom-nav-text {
  margin-top: 8rpx;
  font-size: 20rpx;
  line-height: 1;
  color: #999999;
}

.bottom-nav-text-active {
  color: var(--color-primary);
}

.center-button {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50rpx;
  background: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 16rpx 34rpx rgba(255, 125, 0, 0.32);
}

.center-icon {
  width: 48rpx;
  height: 48rpx;
}
```

- [ ] **Step 2: Commit**

```bash
git add miniprogram/components/bottom-nav/bottom-nav.wxss
git commit -m "style: bottom-nav use CSS variables instead of hardcoded colors"
```

---

### Task 3: 更新 navigation-bar 组件样式

**Files:**
- Modify: `miniprogram/components/navigation-bar/navigation-bar.wxss`
- Read first: `miniprogram/components/navigation-bar/navigation-bar.wxml`

- [ ] **Step 1: 读取当前 navigation-bar 文件**

读取 `miniprogram/components/navigation-bar/navigation-bar.wxml` 和 `.wxss` 了解当前结构。

- [ ] **Step 2: 更新 navigation-bar.wxss**

确保以下关键样式：

```css
:host {
  display: block;
}

.nav-bar {
  background: #FFFFFF;
  border-bottom: 1rpx solid var(--color-border);
}

.nav-content {
  display: flex;
  flex-direction: row;
  align-items: center;
  height: 88rpx;
  padding: 0 24rpx;
}

.nav-back {
  width: 60rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-shrink: 0;
}

.nav-back-icon {
  font-size: 36rpx;
  color: var(--color-text-primary);
}

.nav-title {
  flex: 1;
  text-align: center;
  font-size: 36rpx;
  font-weight: 600;
  color: var(--color-text-primary);
}

.nav-right {
  width: 60rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
}
```

- [ ] **Step 3: Commit**

```bash
git add miniprogram/components/navigation-bar/
git commit -m "style: navigation-bar white background + orange theme"
```

---

### Task 4: 更新 bar-chart 和 pie-chart 组件样式

**Files:**
- Modify: `miniprogram/components/bar-chart/bar-chart.wxss`
- Modify: `miniprogram/components/pie-chart/pie-chart.wxss`

这两个图表组件在统计分析页使用。需要将激活色/主色改为橙色。

- [ ] **Step 1: 读取当前文件**

读取 `miniprogram/components/bar-chart/bar-chart.wxss` 和 `pie-chart/pie-chart.wxss`。

- [ ] **Step 2: 更新 bar-chart 默认柱色**

在 `bar-chart.ts` 中查找默认 barColor 属性，确认 statistics 页已经通过 `barColor="{{barColor}}"` 动态传入（当前 statistics.ts 中 barColor 应由 typeIndex 决定：支出用 `var(--color-primary)`，收入用 `var(--color-income)`）。

更新 `bar-chart.wxss` 确保布局样式使用 CSS 变量：
```css
/* bar-chart 容器 */
.bar-chart {
  padding: 0 8rpx;
}

.bar-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.bar-label {
  font-size: 20rpx;
  color: var(--color-text-secondary);
  margin-top: 8rpx;
}
```

- [ ] **Step 3: 更新 pie-chart.wxss**

```css
/* 饼图图例 */
.pie-total-label {
  font-size: 22rpx;
  color: var(--color-text-secondary);
}

.pie-total-amount {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--color-text-primary);
}
```

- [ ] **Step 4: Commit**

```bash
git add miniprogram/components/bar-chart/ miniprogram/components/pie-chart/
git commit -m "style: bar-chart/pie-chart use CSS variables"
```

---

### Task 5: 更新 summary-card 组件（小幅调整）

**Files:**
- Modify: `miniprogram/components/summary-card/summary-card.wxss`
- Modify: `miniprogram/components/summary-card/summary-card.wxml`

当前 summary-card 已有橙色渐变，但需要微调使其完全对齐设计稿（添加剩余天数显示）。

- [ ] **Step 1: 更新 summary-card.wxml 添加余额标签行**

将当前的 `.card-label` 行改为包含左侧标签和右侧剩余天数（通过 property 传入）：

```xml
<view class="summary-card">
  <view class="card-top-row">
    <text class="card-label">本月余额</text>
    <text class="card-days" wx:if="{{daysLeft}}">剩余{{daysLeft}}天</text>
  </view>
  <text class="card-balance">¥ {{balance}}</text>

  <view class="stats-row">
    <view class="stat-card">
      <view class="stat-head">
        <image class="stat-icon" src="/images/new/trending-up.png" mode="aspectFit" />
        <text class="stat-label">收入</text>
      </view>
      <text class="stat-amount">¥ {{income}}</text>
    </view>
    <view class="stat-card">
      <view class="stat-head">
        <image class="stat-icon" src="/images/new/trending-down.png" mode="aspectFit" />
        <text class="stat-label">支出</text>
      </view>
      <text class="stat-amount">¥ {{expense}}</text>
    </view>
  </view>
</view>
```

- [ ] **Step 2: 更新 summary-card.wxss**

在现有样式中新增：
```css
.card-top-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10rpx;
}

.card-days {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.8);
}
```

并将现有的 `.card-label` 的 `margin-bottom` 移除（已由 `.card-top-row` 控制）：
```css
.card-label {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.92);
}
```

- [ ] **Step 3: 更新 summary-card.ts — 添加 daysLeft property**

在 `miniprogram/components/summary-card/summary-card.ts` 的 properties 中添加：
```typescript
daysLeft: {
  type: Number,
  value: 0,
},
```

- [ ] **Step 4: 更新 home.ts — 传入 daysLeft**

在 `miniprogram/pages/home/home.ts` 的 summaryData 计算中添加 daysLeft 计算并传入 summary-card。

> 注：daysLeft 是当月剩余天数，计算方式：`new Date(year, month, 0).getDate() - new Date().getDate()`

- [ ] **Step 5: 更新 home.wxml — 传入 daysLeft**

```xml
<summary-card wx:if="{{!searchVisible}}" income="{{income}}" expense="{{expense}}" balance="{{balance}}"
              expenseBudget="{{expenseBudget}}" expenseRaw="{{expenseRaw}}" daysLeft="{{daysLeft}}" />
```

- [ ] **Step 6: Commit**

```bash
git add miniprogram/components/summary-card/ miniprogram/pages/home/home.ts miniprogram/pages/home/home.wxml
git commit -m "feat: summary-card add daysLeft display"
```

---

### Task 6: 更新 record-item 组件样式

**Files:**
- Modify: `miniprogram/components/record-item/record-item.wxss`

当前 record-item 已有基本样式，需要对齐设计稿（圆角图标、正确字号/颜色）。

- [ ] **Step 1: 读取当前 record-item.wxss**

先读取 `miniprogram/components/record-item/record-item.wxss` 和 `record-item.wxml` 了解现有结构。

- [ ] **Step 2: 更新 record-item.wxss**

确保以下关键样式正确：
```css
.record-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 24rpx 32rpx;
  min-height: 100rpx;
  box-sizing: border-box;
  background: var(--color-bg-card);
}

.record-icon-wrap {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 24rpx;
  flex-shrink: 0;
}

.record-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.record-category {
  font-size: 28rpx;
  font-weight: 500;
  color: var(--color-text-primary);
}

.record-note {
  font-size: 24rpx;
  color: var(--color-text-secondary);
  margin-top: 4rpx;
}

.record-amount-income {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--color-income);
}

.record-amount-expense {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--color-expense);
}
```

- [ ] **Step 3: Commit**

```bash
git add miniprogram/components/record-item/
git commit -m "style: update record-item to orange design system"
```

---

## Chunk 2: 主 Tab 页面

### Task 4: 更新首页 (home) 样式

**Files:**
- Modify: `miniprogram/pages/home/home.wxss`
- Modify: `miniprogram/pages/home/home.wxml`

需要：1) 将草稿提示卡颜色从绿色改为橙色，2) 新增"本月消费分析"分类进度条区块。

- [ ] **Step 1: 更新 home.wxss — 修复颜色**

将 `.draft-hint-card` 从绿色改为橙色：
```css
.draft-hint-card {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin: 16rpx 24rpx 0;
  padding: 22rpx 28rpx;
  background: var(--color-primary-light);
  border-radius: 16rpx;
  border-left: 8rpx solid var(--color-primary);
}

.draft-hint-text {
  font-size: 26rpx;
  color: #8B4513;
  font-weight: 500;
}

.draft-hint-arrow {
  font-size: 24rpx;
  color: var(--color-primary);
  font-weight: 600;
}
```

新增本月消费分析样式：
```css
.analysis-section {
  margin: 8rpx 24rpx 16rpx;
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
  padding: 28rpx 28rpx 8rpx;
}

.analysis-title {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: 20rpx;
}

.analysis-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-bottom: 20rpx;
}

.analysis-name {
  font-size: 26rpx;
  color: var(--color-text-primary);
  width: 120rpx;
  flex-shrink: 0;
}

.analysis-bar-wrap {
  flex: 1;
  height: 12rpx;
  background: #f0f0f0;
  border-radius: 6rpx;
  margin: 0 20rpx;
  overflow: hidden;
}

.analysis-bar-fill {
  height: 100%;
  border-radius: 6rpx;
  background: var(--color-primary);
}

.analysis-amount {
  font-size: 26rpx;
  color: var(--color-text-secondary);
  width: 100rpx;
  text-align: right;
  flex-shrink: 0;
}
```

- [ ] **Step 2: 更新 home.wxml — 添加本月消费分析区块**

在记录列表 `</view>` 关闭后（`record-groups` 内），在 `</scroll-view>` 前添加：

```xml
<!-- 本月消费分析 -->
<view class="analysis-section" wx:if="{{!searchVisible && analysisItems.length > 0}}">
  <text class="analysis-title">本月消费分析</text>
  <view class="analysis-item" wx:for="{{analysisItems}}" wx:key="category">
    <text class="analysis-name">{{item.category}}</text>
    <view class="analysis-bar-wrap">
      <view class="analysis-bar-fill" style="width: {{item.percent}}%; background: {{item.color}};"></view>
    </view>
    <text class="analysis-amount">¥{{item.amountText}}</text>
  </view>
</view>
```

- [ ] **Step 3: 更新 home.ts — 计算 analysisItems**

在 `home.ts` 的 data 中添加 `analysisItems: []`，在加载记录后计算按分类汇总的消费数据：

```typescript
// 按分类汇总支出，取前5，计算百分比
const categoryMap: Record<string, number> = {}
records.filter(r => r.type === 'expense').forEach(r => {
  categoryMap[r.category] = (categoryMap[r.category] || 0) + r.amount
})
const total = Object.values(categoryMap).reduce((a, b) => a + b, 0)
const colours = ['#FF7D00', '#4CAF50', '#2196F3', '#9C27B0', '#FF5722']
const analysisItems = Object.entries(categoryMap)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([category, amount], i) => ({
    category,
    amountText: amount.toFixed(0),
    percent: total > 0 ? Math.round((amount / total) * 100) : 0,
    color: colours[i % colours.length],
  }))
this.setData({ analysisItems })
```

- [ ] **Step 4: Commit**

```bash
git add miniprogram/pages/home/
git commit -m "style: home page orange theme + monthly analysis section"
```

---

### Task 5: 更新快速记账页 (quick-add) 样式

**Files:**
- Modify: `miniprogram/pages/quick-add/quick-add.wxss`

当前 wxml 结构已基本对齐设计稿，主要是 wxss 颜色/样式更新。

- [ ] **Step 1: 读取当前 quick-add.wxss**

读取 `miniprogram/pages/quick-add/quick-add.wxss` 了解现有样式。

- [ ] **Step 2: 更新 quick-add.wxss**

关键样式改动（以下为需要确保的状态，读完文件后按需修改）：

```css
/* 支出/收入切换 */
.type-switch {
  display: flex;
  background: #f0f0f0;
  border-radius: 40rpx;
  margin: 24rpx 32rpx;
  padding: 6rpx;
}

.type-pill {
  flex: 1;
  height: 68rpx;
  line-height: 68rpx;
  text-align: center;
  border-radius: 36rpx;
  font-size: 28rpx;
  color: var(--color-text-secondary);
  transition: all 0.2s;
}

.type-pill.active {
  background: var(--color-primary);
  color: #fff;
  font-weight: 600;
}

/* 金额面板 */
.amount-input {
  font-size: 64rpx;
  font-weight: 700;
  color: var(--color-text-primary);
  text-align: center;
}

/* 分类网格 */
.category-item.active .category-badge {
  box-shadow: 0 0 0 4rpx var(--color-primary);
}

/* 保存按钮 */
.save-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 24rpx 32rpx calc(24rpx + env(safe-area-inset-bottom));
  background: #fff;
}

.save-button {
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  border-radius: var(--radius-btn);
  background: var(--color-primary);
  color: #fff;
  font-size: 32rpx;
  font-weight: 600;
}
```

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/quick-add/
git commit -m "style: quick-add page orange theme"
```

---

### Task 6: 更新预算管理页 (budget) 样式

**Files:**
- Modify: `miniprogram/pages/budget/budget.wxss`

- [ ] **Step 1: 读取当前 budget.wxss**

读取 `miniprogram/pages/budget/budget.wxss`。

- [ ] **Step 2: 更新 budget.wxss**

关键样式：

```css
.budget-card {
  margin: 24rpx 24rpx 16rpx;
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
  padding: 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.06);
}

.budget-card-title {
  font-size: 26rpx;
  color: var(--color-text-secondary);
}

.budget-card-days {
  font-size: 24rpx;
  color: var(--color-text-secondary);
}

.budget-main-amount {
  font-size: 52rpx;
  font-weight: 700;
  color: var(--color-text-primary);
}

.budget-main-sub {
  font-size: 26rpx;
  color: var(--color-text-secondary);
  margin-left: 8rpx;
  align-self: flex-end;
  margin-bottom: 8rpx;
}

/* 进度条 */
.progress-track {
  height: 12rpx;
  background: #f0f0f0;
  border-radius: 6rpx;
  margin: 20rpx 0 12rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 6rpx;
  transition: width 0.3s;
}

.progress-fill-over {
  background: var(--color-expense);
}

/* 分类预算项 */
.budget-item {
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
  margin: 0 24rpx 12rpx;
  padding: 24rpx 28rpx;
}

.budget-item-track {
  height: 8rpx;
  background: #f0f0f0;
  border-radius: 4rpx;
  margin-top: 16rpx;
  overflow: hidden;
}
```

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/budget/
git commit -m "style: budget page orange theme"
```

---

### Task 7: 更新统计分析页 (statistics) 样式

**Files:**
- Modify: `miniprogram/pages/statistics/statistics.wxss`

- [ ] **Step 1: 读取当前 statistics.wxss**

读取 `miniprogram/pages/statistics/statistics.wxss`。

- [ ] **Step 2: 更新 statistics.wxss**

关键样式：

```css
.page-body {
  background: var(--color-bg-page);
  min-height: 100vh;
}

.page-header {
  background: var(--color-bg-card);
  padding: 0 32rpx 20rpx;
}

.page-title {
  font-size: 36rpx;
  font-weight: 600;
  color: var(--color-text-primary);
}

/* 收入/支出摘要卡片横排 */
.summary-row {
  display: flex;
  gap: 16rpx;
  margin: 16rpx 24rpx;
}

.summary-card {
  flex: 1;
  border-radius: var(--radius-card);
  padding: 24rpx;
}

.income-card {
  background: #E8F5E9;
}

.expense-card {
  background: #FFF3E0;
}

.income-label {
  color: var(--color-income);
}

.expense-label {
  color: var(--color-primary);
}

.summary-value {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-top: 8rpx;
  display: block;
}

/* 图表卡片 */
.section-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
  margin: 0 24rpx 16rpx;
  padding: 28rpx;
}

/* 趋势类型切换 */
.type-switch {
  display: flex;
  flex-direction: row;
  gap: 16rpx;
  margin: 0 24rpx 16rpx;
}

.type-chip {
  padding: 10rpx 32rpx;
  border-radius: 32rpx;
  font-size: 26rpx;
  color: var(--color-text-secondary);
  background: var(--color-bg-card);
}

.type-chip.active {
  background: var(--color-primary);
  color: #fff;
  font-weight: 600;
}

/* 周/月/年 compare tabs */
.compare-tab {
  font-size: 24rpx;
  color: var(--color-text-secondary);
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
}

.compare-tab.active {
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-weight: 600;
}
```

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/statistics/
git commit -m "style: statistics page orange theme"
```

---

### Task 8: 更新交易记录页 (records) 样式

**Files:**
- Modify: `miniprogram/pages/records/records.wxss`
- Modify: `miniprogram/pages/records/records.wxml`

- [ ] **Step 1: 读取当前 records.wxml 和 records.wxss**

读取这两个文件了解结构。

- [ ] **Step 2: 更新 records.wxss**

关键样式：

```css
.page-body {
  background: var(--color-bg-page);
  min-height: 100vh;
}

/* 搜索框 */
.search-bar {
  margin: 16rpx 24rpx;
  background: var(--color-bg-card);
  border-radius: 40rpx;
  display: flex;
  align-items: center;
  padding: 16rpx 24rpx;
}

/* 筛选 Tab */
.filter-tabs {
  display: flex;
  flex-direction: row;
  background: var(--color-bg-card);
  margin: 0 24rpx 16rpx;
  border-radius: 40rpx;
  padding: 6rpx;
}

.filter-tab {
  flex: 1;
  text-align: center;
  height: 60rpx;
  line-height: 60rpx;
  font-size: 24rpx;
  color: var(--color-text-secondary);
  border-radius: 36rpx;
}

.filter-tab.active {
  background: var(--color-primary);
  color: #fff;
  font-weight: 600;
}

/* 日期分组 */
.day-group {
  margin: 0 24rpx 16rpx;
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
  overflow: hidden;
}

.day-header {
  padding: 20rpx 28rpx;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1rpx solid var(--color-border);
}

.day-date {
  font-size: 26rpx;
  font-weight: 500;
  color: var(--color-text-primary);
}

.day-net {
  font-size: 24rpx;
  font-weight: 600;
}
```

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/records/
git commit -m "style: records page orange theme"
```

---

### Task 9: 更新我的页 (settings) 样式

**Files:**
- Modify: `miniprogram/pages/settings/settings.wxss`
- Modify: `miniprogram/pages/settings/settings.wxml`

当前 settings.wxml 结构基本对齐设计稿（含4列统计数字、菜单组、定期账单入口），无需大幅重写。读完文件后若发现结构问题则同步更新 wxml；否则仅更新 wxss。

- [ ] **Step 1: 读取当前 settings.wxss**

读取 `miniprogram/pages/settings/settings.wxss`。

- [ ] **Step 2: 更新 settings.wxss**

```css
.page-body {
  background: var(--color-bg-page);
}

/* 顶部统计区 */
.stats-row {
  background: var(--color-bg-card);
  display: flex;
  flex-direction: row;
  padding: 40rpx 0 32rpx;
  margin-bottom: 24rpx;
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-right: 1rpx solid var(--color-border);
}

.stat-item:last-child {
  border-right: none;
}

.stat-value {
  font-size: 44rpx;
  font-weight: 700;
  color: var(--color-primary);
}

.stat-label {
  font-size: 22rpx;
  color: var(--color-text-secondary);
  margin-top: 8rpx;
}

/* 区块标题 */
.section-header {
  font-size: 24rpx;
  color: var(--color-text-secondary);
  padding: 8rpx 32rpx 12rpx;
  letter-spacing: 1rpx;
}

/* 菜单组（改为 .menu-group） */
.settings-group {
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
  margin: 0 24rpx 16rpx;
  overflow: hidden;
}

.settings-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 28rpx 32rpx;
  min-height: 100rpx;
  box-sizing: border-box;
}

.item-icon-img {
  width: 40rpx;
  height: 40rpx;
  margin-right: 24rpx;
  flex-shrink: 0;
}

.item-label {
  font-size: 28rpx;
  color: var(--color-text-primary);
}

.item-arrow {
  font-size: 32rpx;
  color: #C8C8C8;
}

.divider {
  height: 1rpx;
  background: var(--color-border);
  margin: 0 32rpx;
}

/* 退出登录 */
.logout-btn {
  margin: 40rpx 24rpx 24rpx;
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  border-radius: var(--radius-btn);
  background: var(--color-bg-card);
  color: var(--color-expense);
  font-size: 30rpx;
  font-weight: 600;
}

/* app 信息 */
.app-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16rpx 0 40rpx;
}

.app-name {
  font-size: 24rpx;
  color: var(--color-text-secondary);
}

.app-version {
  font-size: 22rpx;
  color: #C8C8C8;
  margin-top: 6rpx;
}
```

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/settings/
git commit -m "style: settings page orange theme"
```

---

## Chunk 3: 功能页面

### Task 10: 更新分类管理页 (category-manage)

**Files:**
- Modify: `miniprogram/pages/category-manage/category-manage.wxss`
- Modify: `miniprogram/pages/category-manage/category-manage.wxml`

- [ ] **Step 1: 读取当前文件**

读取 `miniprogram/pages/category-manage/category-manage.wxml` 和 `.wxss`。

- [ ] **Step 2: 更新 category-manage.wxss**

```css
.page-body {
  background: var(--color-bg-page);
  min-height: 100vh;
}

/* 支出/收入 Tab */
.type-tabs {
  display: flex;
  background: var(--color-bg-card);
  border-bottom: 1rpx solid var(--color-border);
  margin-bottom: 16rpx;
}

.type-tab {
  flex: 1;
  text-align: center;
  padding: 28rpx 0;
  font-size: 28rpx;
  color: var(--color-text-secondary);
}

.type-tab.active {
  color: var(--color-primary);
  font-weight: 600;
  border-bottom: 4rpx solid var(--color-primary);
}

/* 分类网格 */
.category-grid {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  padding: 16rpx 24rpx;
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
  margin: 0 24rpx 16rpx;
}

.category-item {
  width: 25%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20rpx 0;
}

.category-icon-wrap {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.category-name {
  font-size: 22rpx;
  color: var(--color-text-primary);
  margin-top: 10rpx;
}

/* 添加分类按钮 */
.add-category-btn {
  margin: 0 24rpx 24rpx;
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  border-radius: var(--radius-card);
  background: var(--color-bg-card);
  color: var(--color-primary);
  font-size: 28rpx;
  border: 2rpx dashed var(--color-primary);
}
```

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/category-manage/
git commit -m "style: category-manage page orange theme"
```

---

### Task 11: 更新语音记账页 (voice-input)

**Files:**
- Modify: `miniprogram/pages/voice-input/voice-input.wxss`
- Modify: `miniprogram/pages/voice-input/voice-input.wxml`

- [ ] **Step 1: 读取当前文件**

读取 `miniprogram/pages/voice-input/voice-input.wxml` 和 `.wxss`。

- [ ] **Step 2: 更新 voice-input.wxml**

确保结构符合设计稿（居中麦克风大按钮、提示文字、示例标签）：

```xml
<navigation-bar title="语音记账" back="{{true}}" />
<view class="page-body">
  <view class="voice-main">
    <text class="voice-tip">请说出您的消费记录</text>
    <text class="voice-sub">点击麦克风按钮开始语音输入</text>

    <view class="mic-btn {{recording ? 'mic-active' : ''}}" bindtap="onMicTap">
      <image class="mic-icon" src="/images/new/mic.png" mode="aspectFit" />
    </view>

    <!-- 音波动画（录音时显示） -->
    <view class="wave-wrap" wx:if="{{recording}}">
      <view class="wave-bar" wx:for="{{5}}" wx:key="*this" style="animation-delay: {{index * 0.1}}s;"></view>
    </view>
  </view>

  <!-- 示例提示词 -->
  <view class="example-section">
    <view class="example-item" wx:for="{{examples}}" wx:key="*this">
      <text class="example-text">"{{item}}"</text>
    </view>
  </view>
</view>
```

- [ ] **Step 3: 更新 voice-input.wxss**

```css
.page-body {
  background: var(--color-bg-page);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.voice-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 80rpx;
}

.voice-tip {
  font-size: 36rpx;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 16rpx;
}

.voice-sub {
  font-size: 26rpx;
  color: var(--color-text-secondary);
  margin-bottom: 80rpx;
}

.mic-btn {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary-gradient-start), var(--color-primary-gradient-end));
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 20rpx 40rpx rgba(255, 125, 0, 0.35);
}

.mic-btn.mic-active {
  box-shadow: 0 0 0 20rpx rgba(255, 125, 0, 0.15), 0 20rpx 40rpx rgba(255, 125, 0, 0.35);
}

.mic-icon {
  width: 80rpx;
  height: 80rpx;
}

/* 音波动画 */
.wave-wrap {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  gap: 8rpx;
  height: 60rpx;
  margin-top: 40rpx;
}

.wave-bar {
  width: 8rpx;
  height: 40rpx;
  background: var(--color-primary);
  border-radius: 4rpx;
  animation: wave 0.8s ease-in-out infinite alternate;
}

@keyframes wave {
  from { height: 12rpx; }
  to { height: 56rpx; }
}

/* 示例 */
.example-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  padding: 40rpx 32rpx;
  width: 100%;
  box-sizing: border-box;
}

.example-item {
  background: var(--color-primary-light);
  border-radius: 40rpx;
  padding: 16rpx 32rpx;
}

.example-text {
  font-size: 26rpx;
  color: var(--color-primary);
}
```

- [ ] **Step 4: Commit**

```bash
git add miniprogram/pages/voice-input/
git commit -m "style: voice-input page orange redesign"
```

---

### Task 12: 更新小票扫描页 (photo-scan)

**Files:**
- Modify: `miniprogram/pages/photo-scan/photo-scan.wxss`
- Modify: `miniprogram/pages/photo-scan/photo-scan.wxml`

- [ ] **Step 1: 读取当前文件**

读取 `miniprogram/pages/photo-scan/photo-scan.wxml` 和 `.wxss`。

- [ ] **Step 2: 更新 photo-scan.wxml**

确保符合设计稿结构（取景框、扫描按钮、历史列表）。关键结构：

```xml
<navigation-bar title="小票扫描" back="{{true}}" />
<scroll-view scroll-y class="page-body">
  <!-- 取景框 -->
  <view class="scan-frame">
    <view class="scan-corner tl"></view>
    <view class="scan-corner tr"></view>
    <view class="scan-corner bl"></view>
    <view class="scan-corner br"></view>
    <image class="scan-placeholder-icon" src="/images/camera.png" mode="aspectFit" wx:if="{{!scanning}}" />
    <text class="scan-placeholder-text" wx:if="{{!scanning}}">将小票对准框内</text>
  </view>

  <!-- 操作按钮 -->
  <view class="scan-actions">
    <view class="scan-btn-primary" bindtap="onScan">
      <text>拍照扫描</text>
    </view>
    <view class="scan-btn-secondary" bindtap="onPickImage">
      <text>从相册选择图片</text>
    </view>
  </view>

  <!-- 最近扫描 -->
  <view class="recent-header" wx:if="{{recentScans.length > 0}}">
    <text class="recent-title">最近扫描</text>
    <text class="recent-all">查看全部</text>
  </view>
  <view class="recent-list" wx:if="{{recentScans.length > 0}}">
    <view class="recent-item" wx:for="{{recentScans}}" wx:key="id" bindtap="onScanDetail" data-id="{{item.id}}">
      <view class="recent-info">
        <text class="recent-name">{{item.name}}</text>
        <text class="recent-date">{{item.date}}</text>
      </view>
      <view class="recent-right">
        <text class="recent-amount">¥{{item.amount}}</text>
        <text class="recent-arrow">›</text>
      </view>
    </view>
  </view>

  <!-- 小贴士 -->
  <view class="tips-section">
    <image class="tips-icon" src="/images/new/scan-line.png" mode="aspectFit" />
    <text class="tips-text">扫描小票平整，融合光线，避免模糊</text>
  </view>
</scroll-view>
```

- [ ] **Step 3: 更新 photo-scan.wxss**

```css
.page-body {
  background: var(--color-bg-page);
  min-height: 100vh;
}

/* 取景框 */
.scan-frame {
  margin: 24rpx 32rpx;
  height: 440rpx;
  background: #1a1a1a;
  border-radius: 20rpx;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.scan-corner {
  position: absolute;
  width: 40rpx;
  height: 40rpx;
  border-color: var(--color-primary);
  border-style: solid;
}
.scan-corner.tl { top: 20rpx; left: 20rpx; border-width: 6rpx 0 0 6rpx; border-top-left-radius: 8rpx; }
.scan-corner.tr { top: 20rpx; right: 20rpx; border-width: 6rpx 6rpx 0 0; border-top-right-radius: 8rpx; }
.scan-corner.bl { bottom: 20rpx; left: 20rpx; border-width: 0 0 6rpx 6rpx; border-bottom-left-radius: 8rpx; }
.scan-corner.br { bottom: 20rpx; right: 20rpx; border-width: 0 6rpx 6rpx 0; border-bottom-right-radius: 8rpx; }

.scan-placeholder-icon {
  width: 80rpx;
  height: 80rpx;
  opacity: 0.4;
}

.scan-placeholder-text {
  font-size: 26rpx;
  color: rgba(255,255,255,0.5);
  margin-top: 16rpx;
}

/* 按钮 */
.scan-actions {
  padding: 0 32rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-bottom: 32rpx;
}

.scan-btn-primary {
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  border-radius: var(--radius-btn);
  background: var(--color-primary);
  color: #fff;
  font-size: 30rpx;
  font-weight: 600;
}

.scan-btn-secondary {
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  border-radius: var(--radius-btn);
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  font-size: 28rpx;
  border: 1rpx solid var(--color-border);
}

/* 最近扫描 */
.recent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 32rpx 16rpx;
}

.recent-title {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--color-text-primary);
}

.recent-all {
  font-size: 24rpx;
  color: var(--color-primary);
}

.recent-list {
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
  margin: 0 24rpx 16rpx;
  overflow: hidden;
}

.recent-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 28rpx 32rpx;
  border-bottom: 1rpx solid var(--color-border);
}

.recent-item:last-child {
  border-bottom: none;
}

.recent-info {
  flex: 1;
}

.recent-name {
  font-size: 28rpx;
  color: var(--color-text-primary);
}

.recent-date {
  font-size: 22rpx;
  color: var(--color-text-secondary);
  margin-top: 6rpx;
}

.recent-right {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.recent-amount {
  font-size: 28rpx;
  color: var(--color-expense);
  font-weight: 600;
}

.recent-arrow {
  color: #C8C8C8;
  font-size: 32rpx;
}

/* 小贴士 */
.tips-section {
  display: flex;
  align-items: center;
  background: var(--color-primary-light);
  border-radius: 16rpx;
  margin: 0 24rpx 40rpx;
  padding: 20rpx 24rpx;
  gap: 16rpx;
}

.tips-icon {
  width: 36rpx;
  height: 36rpx;
  flex-shrink: 0;
}

.tips-text {
  font-size: 24rpx;
  color: var(--color-primary);
  line-height: 1.5;
}
```

- [ ] **Step 4: Commit**

```bash
git add miniprogram/pages/photo-scan/
git commit -m "style: photo-scan page orange redesign"
```

---

### Task 13: 更新手动记账页 (add-record)

**Files:**
- Modify: `miniprogram/pages/add-record/add-record.wxss`
- Modify: `miniprogram/pages/add-record/add-record.wxml`

- [ ] **Step 1: 读取当前文件**

读取 `miniprogram/pages/add-record/add-record.wxml` 和 `.wxss`。

- [ ] **Step 2: 更新 add-record.wxss**

add-record 与 quick-add 功能类似，应用相同设计语言：

```css
/* 支出/收入切换 */
.type-switch {
  display: flex;
  background: #f0f0f0;
  border-radius: 40rpx;
  margin: 24rpx 32rpx;
  padding: 6rpx;
}

.type-pill {
  flex: 1;
  height: 68rpx;
  line-height: 68rpx;
  text-align: center;
  border-radius: 36rpx;
  font-size: 28rpx;
  color: var(--color-text-secondary);
}

.type-pill.active {
  background: var(--color-primary);
  color: #fff;
  font-weight: 600;
}

/* 金额输入 */
.amount-input {
  font-size: 64rpx;
  font-weight: 700;
  color: var(--color-text-primary);
  text-align: center;
}

/* 分类激活态 */
.category-item.active .category-badge {
  box-shadow: 0 0 0 4rpx var(--color-primary);
}

/* 保存按钮 */
.save-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 24rpx 32rpx calc(24rpx + env(safe-area-inset-bottom));
  background: #fff;
}

.save-button {
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  border-radius: var(--radius-btn);
  background: var(--color-primary);
  color: #fff;
  font-size: 32rpx;
  font-weight: 600;
}
```

同时搜索 add-record.wxss 中所有硬编码绿色值（`#1AAD19`、`#07c160`）并替换为 `var(--color-primary)`。

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/add-record/
git commit -m "style: add-record page orange theme"
```

---

## Chunk 4: 设置子页面

### Task 14: 更新定期账单页 (recurring) — 保留功能

**Files:**
- Modify: `miniprogram/pages/recurring/recurring.wxss`
- Modify: `miniprogram/pages/recurring/recurring.wxml`

- [ ] **Step 1: 读取当前文件**

读取 `miniprogram/pages/recurring/recurring.wxml` 和 `.wxss`。

- [ ] **Step 2: 更新样式（保留全部功能逻辑）**

将绿色主色改为 `var(--color-primary)`，列表项改为圆角白底卡片：

```css
.page-body {
  background: var(--color-bg-page);
  min-height: 100vh;
}

.recurring-list {
  padding: 16rpx 0;
}

.recurring-item {
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
  margin: 0 24rpx 16rpx;
  padding: 28rpx 32rpx;
}

.recurring-item-name {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--color-text-primary);
}

.recurring-item-sub {
  font-size: 24rpx;
  color: var(--color-text-secondary);
  margin-top: 8rpx;
}

.recurring-item-amount {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--color-expense);
}

/* 右上角添加按钮 */
.nav-add {
  font-size: 48rpx;
  color: var(--color-primary);
  font-weight: 300;
  line-height: 1;
}

/* 空状态 */
.empty-tip {
  text-align: center;
  padding-top: 200rpx;
  font-size: 26rpx;
  color: var(--color-text-secondary);
}
```

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/recurring/
git commit -m "style: recurring page orange theme (logic preserved)"
```

---

### Task 15: 更新定期账单表单页 (recurring-form) — 保留功能

**Files:**
- Modify: `miniprogram/pages/recurring-form/recurring-form.wxss`

- [ ] **Step 1: 读取当前文件**

读取 `miniprogram/pages/recurring-form/recurring-form.wxml` 和 `.wxss`。

- [ ] **Step 2: 更新表单样式**

```css
.page-body {
  background: var(--color-bg-page);
  min-height: 100vh;
}

/* 表单卡片 */
.form-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
  margin: 16rpx 24rpx;
  overflow: hidden;
}

.form-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 28rpx 32rpx;
  min-height: 100rpx;
  box-sizing: border-box;
  border-bottom: 1rpx solid var(--color-border);
}

.form-item:last-child {
  border-bottom: none;
}

.form-label {
  font-size: 28rpx;
  color: var(--color-text-primary);
  width: 160rpx;
  flex-shrink: 0;
}

.form-input {
  flex: 1;
  font-size: 28rpx;
  color: var(--color-text-primary);
  text-align: right;
}

/* 保存按钮 */
.save-btn {
  margin: 40rpx 24rpx;
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  border-radius: var(--radius-btn);
  background: var(--color-primary);
  color: #fff;
  font-size: 32rpx;
  font-weight: 600;
}
```

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/recurring-form/
git commit -m "style: recurring-form page orange theme (logic preserved)"
```

---

### Task 16: 更新待确认草稿页 (pending-drafts) — 保留功能

**Files:**
- Modify: `miniprogram/pages/pending-drafts/pending-drafts.wxss`
- Modify: `miniprogram/pages/pending-drafts/pending-drafts.wxml`

- [ ] **Step 1: 读取当前文件**

读取这两个文件。

- [ ] **Step 2: 更新样式（保留全部功能逻辑）**

```css
.page-body {
  background: var(--color-bg-page);
  min-height: 100vh;
}

.draft-item {
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
  margin: 0 24rpx 16rpx;
  padding: 28rpx 32rpx;
}

.draft-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.draft-item-name {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--color-text-primary);
}

.draft-item-amount {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--color-expense);
}

.draft-item-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
}

.btn-confirm {
  flex: 1;
  height: 72rpx;
  line-height: 72rpx;
  text-align: center;
  border-radius: var(--radius-btn);
  background: var(--color-primary);
  color: #fff;
  font-size: 26rpx;
  font-weight: 600;
}

.btn-ignore {
  flex: 1;
  height: 72rpx;
  line-height: 72rpx;
  text-align: center;
  border-radius: var(--radius-btn);
  background: #f0f0f0;
  color: var(--color-text-secondary);
  font-size: 26rpx;
}
```

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/pending-drafts/
git commit -m "style: pending-drafts page orange theme (logic preserved)"
```

---

### Task 17: 更新预算设置页 (budget-setting)

**Files:**
- Modify: `miniprogram/pages/budget-setting/budget-setting.wxss`

- [ ] **Step 1: 读取当前文件**

读取 `miniprogram/pages/budget-setting/budget-setting.wxml` 和 `.wxss`。

- [ ] **Step 2: 更新样式**

确保保存按钮使用 `var(--color-primary)`，表单项样式使用圆角卡片，与 recurring-form 样式一致（参考 Task 15）。

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/budget-setting/
git commit -m "style: budget-setting page orange theme"
```

---

### Task 18: 更新货币设置页 (currency-setting)

**Files:**
- Modify: `miniprogram/pages/currency-setting/currency-setting.wxss`

- [ ] **Step 1: 读取当前文件**

读取 `miniprogram/pages/currency-setting/currency-setting.wxml` 和 `.wxss`。

- [ ] **Step 2: 更新样式**

货币列表选项，选中态用橙色勾：

```css
.page-body {
  background: var(--color-bg-page);
}

.currency-list {
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
  margin: 16rpx 24rpx;
  overflow: hidden;
}

.currency-item {
  display: flex;
  align-items: center;
  padding: 28rpx 32rpx;
  min-height: 100rpx;
  border-bottom: 1rpx solid var(--color-border);
  box-sizing: border-box;
}

.currency-item:last-child {
  border-bottom: none;
}

.currency-name {
  flex: 1;
  font-size: 28rpx;
  color: var(--color-text-primary);
}

.currency-check {
  font-size: 36rpx;
  color: var(--color-primary);
}
```

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/currency-setting/
git commit -m "style: currency-setting page orange theme"
```

---

### Task 19: 注册并更新分类表单页 (category-form)

**Files:**
- Modify: `miniprogram/app.json` — 添加 category-form 到 pages 列表
- Modify: `miniprogram/pages/category-form/category-form.wxss`
- Modify: `miniprogram/pages/category-form/category-form.wxml`

- [ ] **Step 1: 将 category-form 注册到 app.json**

在 `miniprogram/app.json` 的 pages 数组末尾添加：
```json
"pages/category-form/category-form"
```

- [ ] **Step 2: 读取当前 category-form 文件**

读取 `miniprogram/pages/category-form/category-form.wxml` 和 `.wxss`。

- [ ] **Step 3: 更新 category-form 样式**

参考 Task 15 (recurring-form) 的表单样式，额外包含图标选择网格：

```css
/* 图标网格 */
.icon-grid {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  padding: 16rpx;
}

.icon-item {
  width: 16.66%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16rpx 0;
}

.icon-circle {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-circle.selected {
  box-shadow: 0 0 0 4rpx var(--color-primary);
}

/* 保存按钮 */
.save-btn {
  margin: 40rpx 24rpx;
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  border-radius: var(--radius-btn);
  background: var(--color-primary);
  color: #fff;
  font-size: 32rpx;
  font-weight: 600;
}
```

- [ ] **Step 4: Commit**

```bash
git add miniprogram/app.json miniprogram/pages/category-form/
git commit -m "feat: register category-form page + orange theme"
```

---

## Chunk 5: 最终验收

### Task 20: 全局视觉验收

- [ ] **Step 1: 检查所有页面主色一致性**

搜索项目中所有硬编码的绿色值（`#1AAD19`, `#07c160`, `#1a7a45`），确保全部替换为橙色变量：

```bash
grep -r "#1AAD19\|#07c160\|#1a7a45\|#1aad19" miniprogram/ --include="*.wxss" --include="*.wxml"
```

- [ ] **Step 2: 检查 `--color-primary` 引用覆盖度**

确认所有按钮、激活态、进度条都使用了 CSS 变量而非硬编码值：

```bash
grep -r "color: #FF\|background: #FF" miniprogram/ --include="*.wxss" | grep -v "rgba"
```

- [ ] **Step 3: 修复发现的残留硬编码颜色**

逐一修复 Step 1/2 中发现的问题文件。

- [ ] **Step 4: 最终 commit**

```bash
git add -A
git commit -m "style: fix remaining hardcoded green/color values"
```

---

## 文件变更清单

| 文件 | 变更类型 |
|------|---------|
| `miniprogram/app.wxss` | Modify — 全局 CSS 变量 |
| `miniprogram/app.json` | Modify — 添加 category-form |
| `miniprogram/components/bottom-nav/bottom-nav.wxss` | Modify — 使用 CSS 变量 |
| `miniprogram/components/navigation-bar/navigation-bar.wxss` | Modify — 橙色设计语言 |
| `miniprogram/components/summary-card/summary-card.wxml` | Modify — 添加剩余天数行 |
| `miniprogram/components/summary-card/summary-card.wxss` | Modify |
| `miniprogram/components/summary-card/summary-card.ts` | Modify — 添加 daysLeft property |
| `miniprogram/components/record-item/record-item.wxss` | Modify |
| `miniprogram/components/bar-chart/bar-chart.wxss` | Modify |
| `miniprogram/components/pie-chart/pie-chart.wxss` | Modify |
| `miniprogram/pages/home/home.wxml` | Modify — 添加分析区块、传 daysLeft |
| `miniprogram/pages/home/home.wxss` | Modify |
| `miniprogram/pages/home/home.ts` | Modify — 添加 daysLeft/analysisItems 计算 |
| `miniprogram/pages/quick-add/quick-add.wxss` | Modify |
| `miniprogram/pages/budget/budget.wxss` | Modify |
| `miniprogram/pages/statistics/statistics.wxss` | Modify |
| `miniprogram/pages/records/records.wxml` | Modify (if needed after reading) |
| `miniprogram/pages/records/records.wxss` | Modify |
| `miniprogram/pages/settings/settings.wxml` | Modify (if needed after reading) |
| `miniprogram/pages/settings/settings.wxss` | Modify |
| `miniprogram/pages/category-manage/category-manage.wxml` | Modify (if needed) |
| `miniprogram/pages/category-manage/category-manage.wxss` | Modify |
| `miniprogram/pages/voice-input/voice-input.wxml` | Modify |
| `miniprogram/pages/voice-input/voice-input.wxss` | Modify |
| `miniprogram/pages/photo-scan/photo-scan.wxml` | Modify |
| `miniprogram/pages/photo-scan/photo-scan.wxss` | Modify |
| `miniprogram/pages/add-record/add-record.wxml` | Modify (if needed after reading) |
| `miniprogram/pages/add-record/add-record.wxss` | Modify |
| `miniprogram/pages/recurring/recurring.wxss` | Modify |
| `miniprogram/pages/recurring-form/recurring-form.wxss` | Modify |
| `miniprogram/pages/pending-drafts/pending-drafts.wxss` | Modify |
| `miniprogram/pages/budget-setting/budget-setting.wxss` | Modify |
| `miniprogram/pages/currency-setting/currency-setting.wxss` | Modify |
| `miniprogram/pages/category-form/category-form.wxml` | Modify |
| `miniprogram/pages/category-form/category-form.wxss` | Modify |
