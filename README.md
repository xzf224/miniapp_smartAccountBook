
+## 项目目标
+
+基于微信小程序做一款本地优先的智能记账工具，围绕“低输入成本 + 可视化分析 + 预算约束”这三条主线，覆盖手动记账、快速记账、语音识别记账、拍照识别小票、定期记账、预算管理和消费统计等日常个人财务场景。当前代码已经不只是单点记账工具，而是一个偏完整的个人收支管理小程序。
+
+## 技术栈
+
+- 微信原生小程序
+- TypeScript
+- Skyline 渲染器
+- glass-easel 组件框架
+- 微信云开发云函数
+- 百度语音识别 API
+- 百度 OCR 文字识别 API
+- `wx.setStorageSync` 本地存储
+- Canvas 2D 自绘图表
+- Jest + ts-jest 单元测试
+
+## 目录结构
+
+```text
+miniapp_smartAccountBook/
+├── cloudfunctions/               # 云函数
+│   ├── asr-voice/                # 语音识别中转，调用百度 ASR
+│   └── ocr-receipt/              # 小票 OCR 中转，调用百度 OCR
+├── miniprogram/
+│   ├── components/               # 通用组件
+│   │   ├── bar-chart/
+│   │   ├── bottom-nav/
+│   │   ├── category-grid/
+│   │   ├── navigation-bar/
+│   │   ├── pie-chart/
+│   │   ├── record-item/
+│   │   ├── summary-card/
+│   │   └── swipe-cell/
+│   ├── models/                   # 记账数据模型与常量
+│   ├── pages/                    # 页面
+│   │   ├── home/                 # 首页总览
+│   │   ├── quick-add/            # 快速记账
+│   │   ├── add-record/           # 新增/编辑记录
+│   │   ├── records/              # 记录检索与筛选
+│   │   ├── statistics/           # 统计分析
+│   │   ├── budget/               # 预算总览
+│   │   ├── budget-setting/       # 预算设置与预算提醒阈值
+│   │   ├── recurring/            # 定期记账规则列表
+│   │   ├── recurring-form/       # 定期规则新增/编辑
+│   │   ├── pending-drafts/       # 定期草稿确认
+│   │   ├── voice-input/          # 语音记账
+│   │   ├── photo-scan/           # 小票拍照识别
+│   │   ├── category-manage/      # 分类管理
+│   │   ├── currency-setting/     # 货币设置
+│   │   └── settings/             # 设置、导出、备份恢复、个人资料
+│   ├── utils/                    # 存储、解析、统计、日期、预算提醒等工具
+│   └── app.ts                    # 应用启动与初始化
+├── tests/                        # Jest 单元测试
+├── typings/                      # 小程序类型声明
+├── package.json
+└── project.config.json
+```
+
+## 如何启动
+
+1. 在项目根目录执行 `npm install`。
+2. 用微信开发者工具打开项目根目录 `/Users/eric/Documents/wx_program_2026/miniapp_smartAccountBook`。
+3. 如当前 `appid` 不可用，修改 [project.config.json](/Users/eric/Documents/wx_program_2026/miniapp_smartAccountBook/project.config.json) 中的 `appid` 为你自己的小程序 AppID。
+4. 需要使用语音识别和 OCR 时，在微信云开发中部署 `cloudfunctions/asr-voice` 和 `cloudfunctions/ocr-receipt` 两个云函数，并为它们配置 `BAIDU_API_KEY`、`BAIDU_SECRET_KEY` 环境变量。
+5. 在微信公众平台为百度接口配置合法域名：`https://aip.baidubce.com`、`https://vop.baidu.com`。
+6. 开发调试时可直接在微信开发者工具运行；语音页在 DevTools 下带有 mock 识别文本，OCR 仍依赖云函数。
+7. 需要运行单元测试时执行 `npm test`。
+
+## 当前已完成的核心功能
+
+- 本地账单存储，支持新增、编辑、删除记录，金额按“分”存储。
+- 快速记账页与标准记账页两套录入流程，支持支出/收入切换、日期与备注填写。
+- 首页按月汇总收支、余额、预算状态，并按日期分组展示记录。
+- 记录页支持关键字搜索、按类型/时间/金额/日期区间筛选，以及多种排序方式。
+- 统计页支持月度收支汇总、环形饼图分类占比、日/周/月柱状对比、Top 分类排行。
+- 预算模块支持月总预算、分类预算、预算分配检查、预算超额/阈值提醒。
+- 定期记账支持按天/周/月/年配置规则，并在启动时自动生成待确认草稿。
+- 待确认草稿支持逐条编辑确认、忽略和批量入账。
+- 语音记账支持录音后调用云函数识别，并自动解析为多条候选记录。
+- 小票识别支持拍照/相册导入、云函数 OCR、金额与商家解析、识别结果修正后保存。
+- 分类管理支持自定义收入/支出分类，并为分类设置图标、颜色和初始预算。
+- 货币设置已支持多币种切换，统计、预算和首页展示会按当前币种过滤。
+- 设置页已支持 CSV 导出、JSON 备份恢复、个人资料本地个性化设置。
+- 已补充 `parser`、`statistics`、`date`、`record`、`recurring` 等核心逻辑测试。
+
+## 当前主要页面/模块
+
+- `pages/home`：首页总览、月度收支、预算提醒、最近记录、分类分析入口。
+- `pages/quick-add`：默认主录入页，强调快速选择分类和金额。
+- `pages/add-record`：标准新增/编辑页，处理单条账单编辑。
+- `pages/records`：记录搜索、筛选、汇总统计页。
+- `pages/statistics`：消费结构、趋势对比、预算执行分析。
+- `pages/budget` 与 `pages/budget-setting`：预算总览、分类预算配置、提醒阈值设置。
+- `pages/recurring`、`pages/recurring-form`、`pages/pending-drafts`：定期规则与自动草稿链路。
+- `pages/voice-input`：语音识别记账。
+- `pages/photo-scan`：OCR 小票识别记账。
+- `pages/category-manage`：分类增删与视觉元信息维护。
+- `pages/currency-setting`：全局币种切换。
+- `pages/settings`：导出、备份恢复、资料设置、模块入口聚合。
+- `utils/storage`、`utils/parser`、`utils/statistics`、`utils/recurring`、`utils/budget-alert`：核心业务能力沉淀。
+- `cloudfunctions/asr-voice`、`cloudfunctions/ocr-receipt`：语音和 OCR 的云端能力入口。
