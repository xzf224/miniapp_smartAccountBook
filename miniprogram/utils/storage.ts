import { IRecord, ICategories, IBudget, DEFAULT_CATEGORIES, IRecurringRule, IPendingDraft } from '../models/record'

const RECORDS_KEY = 'records'
const CATEGORIES_KEY = 'categories'
const BUDGETS_KEY = 'budgets'
const RECURRING_RULES_KEY = 'recurring_rules'
const PENDING_DRAFTS_KEY = 'pending_drafts'
const CATEGORY_META_KEY = 'category_meta'
const USER_PROFILE_KEY = 'user_profile'
const BUDGET_ALERT_ENABLED_KEY = 'budgetAlertEnabled'
const BUDGET_ALERT_THRESHOLD_KEY = 'budgetAlertThreshold'
const BUDGET_CATEGORY_ALERT_ENABLED_KEY = 'budgetCategoryAlertEnabled'
const BUDGET_REPEAT_OVER_ALERT_ENABLED_KEY = 'budgetRepeatOverAlertEnabled'
const PENDING_DRAFT_ALERT_ENABLED_KEY = 'pendingDraftAlertEnabled'
const PENDING_DRAFT_ALERT_THRESHOLD_KEY = 'pendingDraftAlertThreshold'

export interface ICategoryMeta {
  icon: string
  color: string
  bgColor: string
}

export interface IUserProfile {
  avatarUrl: string
  nickname: string
  personalized: boolean
}

export interface IReminderSettings {
  budgetAlertEnabled: boolean
  budgetAlertThreshold: number
  budgetCategoryAlertEnabled: boolean
  budgetRepeatOverAlertEnabled: boolean
  pendingDraftAlertEnabled: boolean
  pendingDraftAlertThreshold: number
}

export const DEFAULT_REMINDER_SETTINGS: IReminderSettings = {
  budgetAlertEnabled: false,
  budgetAlertThreshold: 80,
  budgetCategoryAlertEnabled: true,
  budgetRepeatOverAlertEnabled: false,
  pendingDraftAlertEnabled: true,
  pendingDraftAlertThreshold: 3,
}

function normalizePercent(rawValue: unknown, fallback: number): number {
  const value = Number(rawValue)
  if (!Number.isFinite(value)) return fallback
  return Math.min(100, Math.max(1, Math.round(value)))
}

function normalizePositiveInt(rawValue: unknown, fallback: number): number {
  const value = Number(rawValue)
  if (!Number.isFinite(value)) return fallback
  return Math.max(1, Math.round(value))
}

export function getCategoryMeta(): Record<string, ICategoryMeta> {
  return wx.getStorageSync(CATEGORY_META_KEY) || {}
}

export function setCategoryMeta(name: string, meta: ICategoryMeta): void {
  const all = getCategoryMeta()
  all[name] = meta
  wx.setStorageSync(CATEGORY_META_KEY, all)
}

export function getUserProfile(): IUserProfile {
  const profile = wx.getStorageSync(USER_PROFILE_KEY)
  return {
    avatarUrl: typeof profile?.avatarUrl === 'string' ? profile.avatarUrl : '',
    nickname: typeof profile?.nickname === 'string' ? profile.nickname : '',
    personalized: Boolean(profile?.personalized),
  }
}

export function saveUserProfile(profile: Partial<IUserProfile>): void {
  const current = getUserProfile()
  wx.setStorageSync(USER_PROFILE_KEY, {
    ...current,
    ...profile,
  })
}

export function getReminderSettings(): IReminderSettings {
  const budgetAlertEnabled = wx.getStorageSync(BUDGET_ALERT_ENABLED_KEY)
  const budgetAlertThreshold = wx.getStorageSync(BUDGET_ALERT_THRESHOLD_KEY)
  const budgetCategoryAlertEnabled = wx.getStorageSync(BUDGET_CATEGORY_ALERT_ENABLED_KEY)
  const budgetRepeatOverAlertEnabled = wx.getStorageSync(BUDGET_REPEAT_OVER_ALERT_ENABLED_KEY)
  const pendingDraftAlertEnabled = wx.getStorageSync(PENDING_DRAFT_ALERT_ENABLED_KEY)
  const pendingDraftAlertThreshold = wx.getStorageSync(PENDING_DRAFT_ALERT_THRESHOLD_KEY)

  return {
    budgetAlertEnabled: Boolean(budgetAlertEnabled),
    budgetAlertThreshold: normalizePercent(
      budgetAlertThreshold,
      DEFAULT_REMINDER_SETTINGS.budgetAlertThreshold,
    ),
    budgetCategoryAlertEnabled: budgetCategoryAlertEnabled === ''
      ? DEFAULT_REMINDER_SETTINGS.budgetCategoryAlertEnabled
      : budgetCategoryAlertEnabled !== false,
    budgetRepeatOverAlertEnabled: Boolean(budgetRepeatOverAlertEnabled),
    pendingDraftAlertEnabled: pendingDraftAlertEnabled === ''
      ? DEFAULT_REMINDER_SETTINGS.pendingDraftAlertEnabled
      : pendingDraftAlertEnabled !== false,
    pendingDraftAlertThreshold: normalizePositiveInt(
      pendingDraftAlertThreshold,
      DEFAULT_REMINDER_SETTINGS.pendingDraftAlertThreshold,
    ),
  }
}

export function saveReminderSettings(settings: Partial<IReminderSettings>): IReminderSettings {
  const merged = {
    ...getReminderSettings(),
    ...settings,
  }

  wx.setStorageSync(BUDGET_ALERT_ENABLED_KEY, Boolean(merged.budgetAlertEnabled))
  wx.setStorageSync(
    BUDGET_ALERT_THRESHOLD_KEY,
    normalizePercent(merged.budgetAlertThreshold, DEFAULT_REMINDER_SETTINGS.budgetAlertThreshold),
  )
  wx.setStorageSync(BUDGET_CATEGORY_ALERT_ENABLED_KEY, Boolean(merged.budgetCategoryAlertEnabled))
  wx.setStorageSync(BUDGET_REPEAT_OVER_ALERT_ENABLED_KEY, Boolean(merged.budgetRepeatOverAlertEnabled))
  wx.setStorageSync(PENDING_DRAFT_ALERT_ENABLED_KEY, Boolean(merged.pendingDraftAlertEnabled))
  wx.setStorageSync(
    PENDING_DRAFT_ALERT_THRESHOLD_KEY,
    normalizePositiveInt(merged.pendingDraftAlertThreshold, DEFAULT_REMINDER_SETTINGS.pendingDraftAlertThreshold),
  )

  return getReminderSettings()
}

export interface IAppBackupPayload {
  version: number
  exportedAt: number
  records: IRecord[]
  categories: ICategories
  categoryMeta: Record<string, ICategoryMeta>
  budgets: IBudget[]
  recurringRules: IRecurringRule[]
  pendingDrafts: IPendingDraft[]
  userProfile: IUserProfile
  reminderSettings: IReminderSettings
  currencyCode: string
  budgetAlertHistory: Record<string, { level: 'threshold' | 'over'; threshold: number }>
}

const RECORD_TYPES_SET = new Set(['支出', '收入', '不计入收支'])
const BUDGET_TYPES_SET = new Set(['支出', '收入'])
const RECURRING_FREQUENCY_SET = new Set(['daily', 'weekly', 'monthly', 'yearly'])
const CURRENCY_KEY = 'app_currency'
const BUDGET_ALERT_HISTORY_KEY = 'budgetAlertHistory'

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidDateText(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function sanitizeRecord(value: unknown): IRecord | null {
  if (!isPlainObject(value)) return null
  const amount = toFiniteNumber(value.amount)
  const createTime = toFiniteNumber(value.createTime)
  const updateTime = toFiniteNumber(value.updateTime)
  if (
    typeof value.id !== 'string'
    || !RECORD_TYPES_SET.has(value.type)
    || typeof value.category !== 'string'
    || amount === null
    || !isValidDateText(value.date)
    || typeof value.note !== 'string'
    || createTime === null
    || updateTime === null
  ) {
    return null
  }

  const record: IRecord = {
    id: value.id,
    type: value.type as IRecord['type'],
    category: value.category,
    amount: Math.round(amount),
    date: value.date,
    note: value.note,
    createTime,
    updateTime,
  }

  if (Array.isArray(value.tags)) {
    record.tags = normalizeStringArray(value.tags)
  }
  if (typeof value.currency === 'string' && value.currency) {
    record.currency = value.currency
  }

  return record
}

function sanitizeBudget(value: unknown): IBudget | null {
  if (!isPlainObject(value)) return null
  const year = toFiniteNumber(value.year)
  const month = toFiniteNumber(value.month)
  const amount = toFiniteNumber(value.amount)
  if (
    year === null
    || month === null
    || amount === null
    || !BUDGET_TYPES_SET.has(value.type)
    || typeof value.category !== 'string'
  ) {
    return null
  }

  return {
    year: Math.round(year),
    month: Math.round(month),
    type: value.type as IBudget['type'],
    category: value.category,
    amount: Math.round(amount),
  }
}

function sanitizeRecurringRule(value: unknown): IRecurringRule | null {
  if (!isPlainObject(value)) return null
  const amount = toFiniteNumber(value.amount)
  if (
    typeof value.id !== 'string'
    || typeof value.name !== 'string'
    || !RECORD_TYPES_SET.has(value.type)
    || typeof value.category !== 'string'
    || amount === null
    || typeof value.note !== 'string'
    || !RECURRING_FREQUENCY_SET.has(value.frequency)
    || !isValidDateText(value.startDate)
    || typeof value.lastGeneratedDate !== 'string'
    || typeof value.enabled !== 'boolean'
  ) {
    return null
  }

  const rule: IRecurringRule = {
    id: value.id,
    name: value.name,
    type: value.type as IRecurringRule['type'],
    category: value.category,
    amount: Math.round(amount),
    note: value.note,
    frequency: value.frequency as IRecurringRule['frequency'],
    startDate: value.startDate,
    lastGeneratedDate: value.lastGeneratedDate,
    enabled: value.enabled,
  }

  const dayOfMonth = toFiniteNumber(value.dayOfMonth)
  const dayOfWeek = toFiniteNumber(value.dayOfWeek)
  const monthOfYear = toFiniteNumber(value.monthOfYear)

  if (dayOfMonth !== null) rule.dayOfMonth = Math.round(dayOfMonth)
  if (dayOfWeek !== null) rule.dayOfWeek = Math.round(dayOfWeek)
  if (monthOfYear !== null) rule.monthOfYear = Math.round(monthOfYear)
  if (typeof value.endDate === 'string' && value.endDate) rule.endDate = value.endDate
  if (typeof value.currency === 'string' && value.currency) rule.currency = value.currency

  return rule
}

function sanitizePendingDraft(value: unknown): IPendingDraft | null {
  if (!isPlainObject(value)) return null
  const amount = toFiniteNumber(value.amount)
  const generatedAt = toFiniteNumber(value.generatedAt)
  if (
    typeof value.id !== 'string'
    || typeof value.ruleId !== 'string'
    || typeof value.ruleName !== 'string'
    || !RECORD_TYPES_SET.has(value.type)
    || typeof value.category !== 'string'
    || amount === null
    || typeof value.note !== 'string'
    || !isValidDateText(value.date)
    || generatedAt === null
  ) {
    return null
  }

  const draft: IPendingDraft = {
    id: value.id,
    ruleId: value.ruleId,
    ruleName: value.ruleName,
    type: value.type as IPendingDraft['type'],
    category: value.category,
    amount: Math.round(amount),
    note: value.note,
    date: value.date,
    generatedAt,
  }

  if (typeof value.currency === 'string' && value.currency) {
    draft.currency = value.currency
  }

  return draft
}

function sanitizeCategoryMetaMap(value: unknown): Record<string, ICategoryMeta> {
  if (!isPlainObject(value)) return {}
  const entries = Object.entries(value).filter(([, meta]) =>
    isPlainObject(meta)
      && typeof meta.icon === 'string'
      && typeof meta.color === 'string'
      && typeof meta.bgColor === 'string',
  )

  return entries.reduce<Record<string, ICategoryMeta>>((result, [name, meta]) => {
    result[name] = {
      icon: meta.icon,
      color: meta.color,
      bgColor: meta.bgColor,
    }
    return result
  }, {})
}

function sanitizeUserProfile(value: unknown): IUserProfile {
  if (!isPlainObject(value)) {
    return { avatarUrl: '', nickname: '', personalized: false }
  }

  return {
    avatarUrl: normalizeText(value.avatarUrl),
    nickname: normalizeText(value.nickname),
    personalized: Boolean(value.personalized),
  }
}

function sanitizeReminderSettings(value: unknown): IReminderSettings {
  if (!isPlainObject(value)) return DEFAULT_REMINDER_SETTINGS
  return {
    budgetAlertEnabled: Boolean(value.budgetAlertEnabled),
    budgetAlertThreshold: normalizePercent(value.budgetAlertThreshold, DEFAULT_REMINDER_SETTINGS.budgetAlertThreshold),
    budgetCategoryAlertEnabled: value.budgetCategoryAlertEnabled === undefined
      ? DEFAULT_REMINDER_SETTINGS.budgetCategoryAlertEnabled
      : Boolean(value.budgetCategoryAlertEnabled),
    budgetRepeatOverAlertEnabled: Boolean(value.budgetRepeatOverAlertEnabled),
    pendingDraftAlertEnabled: value.pendingDraftAlertEnabled === undefined
      ? DEFAULT_REMINDER_SETTINGS.pendingDraftAlertEnabled
      : Boolean(value.pendingDraftAlertEnabled),
    pendingDraftAlertThreshold: normalizePositiveInt(
      value.pendingDraftAlertThreshold,
      DEFAULT_REMINDER_SETTINGS.pendingDraftAlertThreshold,
    ),
  }
}

function sanitizeBudgetAlertHistory(value: unknown): Record<string, { level: 'threshold' | 'over'; threshold: number }> {
  if (!isPlainObject(value)) return {}
  return Object.entries(value).reduce<Record<string, { level: 'threshold' | 'over'; threshold: number }>>((result, [key, entry]) => {
    if (!isPlainObject(entry)) return result
    if (entry.level !== 'threshold' && entry.level !== 'over') return result
    result[key] = {
      level: entry.level,
      threshold: normalizePercent(entry.threshold, DEFAULT_REMINDER_SETTINGS.budgetAlertThreshold),
    }
    return result
  }, {})
}

function sanitizeCurrencyCode(code: unknown): string {
  return typeof code === 'string' && CURRENCIES.some(item => item.code === code) ? code : 'CNY'
}

function saveCategoryMetaMap(metaMap: Record<string, ICategoryMeta>): void {
  wx.setStorageSync(CATEGORY_META_KEY, metaMap)
}

function replaceUserProfile(profile: IUserProfile): void {
  wx.setStorageSync(USER_PROFILE_KEY, profile)
}

function replaceBudgetAlertHistory(history: Record<string, { level: 'threshold' | 'over'; threshold: number }>): void {
  wx.setStorageSync(BUDGET_ALERT_HISTORY_KEY, history)
}

function escapeCSVCell(value: unknown): string {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

// ---- 记录 CRUD ----

export function getRecords(): IRecord[] {
  return wx.getStorageSync(RECORDS_KEY) || []
}

export function saveRecords(records: IRecord[]): void {
  wx.setStorageSync(RECORDS_KEY, records)
}

export function addRecord(record: IRecord): void {
  const records = getRecords()
  records.unshift(record)
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
  saveRecords(getRecords().filter(r => r.id !== id))
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
  const types: Array<keyof ICategories> = ['支出', '收入', '不计入收支']
  // Validate that stored data has the correct Chinese keys
  if (cats && Array.isArray(cats['支出']) && Array.isArray(cats['收入'])) {
    // Re-order defaults to match current DEFAULT_CATEGORIES, then append user-added items
    const merged: ICategories = { '支出': [], '收入': [], '不计入收支': [] }
    for (const type of types) {
      const defaults: string[] = DEFAULT_CATEGORIES[type] || []
      const stored: string[] = cats[type] || []
      const userAdded = stored.filter((n: string) => !defaults.includes(n))
      merged[type] = [...defaults, ...userAdded]
    }
    wx.setStorageSync(CATEGORIES_KEY, merged)
    return merged
  }
  const fresh: ICategories = {
    '支出': [...DEFAULT_CATEGORIES['支出']],
    '收入': [...DEFAULT_CATEGORIES['收入']],
    '不计入收支': [...DEFAULT_CATEGORIES['不计入收支']],
  }
  wx.setStorageSync(CATEGORIES_KEY, fresh)
  return fresh
}

export function saveCategories(categories: ICategories): void {
  wx.setStorageSync(CATEGORIES_KEY, categories)
}

export function addCategory(type: keyof ICategories, name: string): boolean {
  const cats = getCategories()
  if (cats[type].includes(name)) return false
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

export function getBudgets(): IBudget[] {
  return wx.getStorageSync(BUDGETS_KEY) || []
}

function saveBudgets(budgets: IBudget[]): void {
  wx.setStorageSync(BUDGETS_KEY, budgets)
}

export function upsertBudget(budget: IBudget): void {
  const budgets = getBudgets()
  const idx = budgets.findIndex(
    b => b.year === budget.year && b.month === budget.month
      && b.type === budget.type && b.category === budget.category,
  )
  if (idx !== -1) budgets[idx] = budget
  else budgets.push(budget)
  saveBudgets(budgets)
}

export function deleteBudget(year: number, month: number, type: string, category: string): void {
  saveBudgets(getBudgets().filter(
    b => !(b.year === year && b.month === month && b.type === type && b.category === category),
  ))
}

// ---- 导出 ----

export function exportRecordsCSV(): string {
  const records = getRecords()
  if (records.length === 0) return ''
  // UTF-8 BOM 让 Excel / Numbers 正确识别中文
  const BOM = '\uFEFF'
  const header = '类型,类别,金额(元),货币,日期,备注,创建时间'
  const rows = records.map(r =>
    [
      escapeCSVCell(r.type),
      escapeCSVCell(r.category),
      escapeCSVCell((r.amount / 100).toFixed(2)),
      escapeCSVCell(r.currency ?? 'CNY'),
      escapeCSVCell(r.date),
      escapeCSVCell(r.note),
      escapeCSVCell(new Date(r.createTime).toLocaleString()),
    ].join(','),
  )
  return BOM + [header, ...rows].join('\n')
}

export function exportBackupJSON(): string {
  const payload: IAppBackupPayload = {
    version: 2,
    exportedAt: Date.now(),
    records: getRecords(),
    categories: getCategories(),
    categoryMeta: getCategoryMeta(),
    budgets: getBudgets(),
    recurringRules: getRecurringRules(),
    pendingDrafts: getPendingDrafts(),
    userProfile: getUserProfile(),
    reminderSettings: getReminderSettings(),
    currencyCode: getCurrencyCode(),
    budgetAlertHistory: wx.getStorageSync(BUDGET_ALERT_HISTORY_KEY) || {},
  }
  return JSON.stringify(payload, null, 2)
}

export function restoreBackupJSON(raw: string): boolean {
  const parsed = JSON.parse(raw || '{}') as Partial<IAppBackupPayload>
  if (!Array.isArray(parsed.records) || !isPlainObject(parsed.categories) || !Array.isArray(parsed.budgets)) {
    return false
  }

  const records = parsed.records.map(sanitizeRecord).filter((item): item is IRecord => Boolean(item))
  const budgets = parsed.budgets.map(sanitizeBudget).filter((item): item is IBudget => Boolean(item))
  const recurringRules = Array.isArray(parsed.recurringRules)
    ? parsed.recurringRules.map(sanitizeRecurringRule).filter((item): item is IRecurringRule => Boolean(item))
    : []
  const pendingDrafts = Array.isArray(parsed.pendingDrafts)
    ? parsed.pendingDrafts.map(sanitizePendingDraft).filter((item): item is IPendingDraft => Boolean(item))
    : []
  const categories: ICategories = {
    '支出': Array.isArray(parsed.categories['支出']) ? normalizeStringArray(parsed.categories['支出']) : [...DEFAULT_CATEGORIES['支出']],
    '收入': Array.isArray(parsed.categories['收入']) ? normalizeStringArray(parsed.categories['收入']) : [...DEFAULT_CATEGORIES['收入']],
    '不计入收支': Array.isArray(parsed.categories['不计入收支']) ? normalizeStringArray(parsed.categories['不计入收支']) : [...DEFAULT_CATEGORIES['不计入收支']],
  }

  if (
    records.length !== parsed.records.length
    || budgets.length !== parsed.budgets.length
    || (Array.isArray(parsed.recurringRules) && recurringRules.length !== parsed.recurringRules.length)
    || (Array.isArray(parsed.pendingDrafts) && pendingDrafts.length !== parsed.pendingDrafts.length)
    || (Array.isArray(parsed.categories['支出']) && categories['支出'].length !== parsed.categories['支出'].length)
    || (Array.isArray(parsed.categories['收入']) && categories['收入'].length !== parsed.categories['收入'].length)
    || (Array.isArray(parsed.categories['不计入收支']) && categories['不计入收支'].length !== parsed.categories['不计入收支'].length)
  ) {
    return false
  }

  saveRecords(records)
  saveCategories(categories)
  saveCategoryMetaMap(sanitizeCategoryMetaMap(parsed.categoryMeta))
  saveBudgets(budgets)
  saveRecurringRules(recurringRules)
  savePendingDrafts(pendingDrafts)
  replaceUserProfile(sanitizeUserProfile(parsed.userProfile))
  saveReminderSettings(sanitizeReminderSettings(parsed.reminderSettings))
  setCurrencyCode(sanitizeCurrencyCode(parsed.currencyCode))
  replaceBudgetAlertHistory(sanitizeBudgetAlertHistory(parsed.budgetAlertHistory))
  return true
}

// ---- 定期规则 CRUD ----

export function getRecurringRules(): IRecurringRule[] {
  return wx.getStorageSync(RECURRING_RULES_KEY) || []
}

export function saveRecurringRules(rules: IRecurringRule[]): void {
  wx.setStorageSync(RECURRING_RULES_KEY, rules)
}

export function addRecurringRule(rule: IRecurringRule): void {
  const rules = getRecurringRules()
  rules.push(rule)
  saveRecurringRules(rules)
}

export function updateRecurringRule(rule: IRecurringRule): void {
  const rules = getRecurringRules()
  const idx = rules.findIndex(r => r.id === rule.id)
  if (idx !== -1) {
    rules[idx] = rule
    saveRecurringRules(rules)
  }
}

export function deleteRecurringRule(id: string): void {
  saveRecurringRules(getRecurringRules().filter(r => r.id !== id))
}

// ---- 待确认草稿 CRUD ----

export function getPendingDrafts(): IPendingDraft[] {
  return wx.getStorageSync(PENDING_DRAFTS_KEY) || []
}

export function savePendingDrafts(drafts: IPendingDraft[]): void {
  wx.setStorageSync(PENDING_DRAFTS_KEY, drafts)
}

export function removePendingDraft(id: string): void {
  savePendingDrafts(getPendingDrafts().filter(d => d.id !== id))
}

// ---- 货币 ----

export const CURRENCIES = [
  { code: 'CNY', symbol: '¥',   name: '人民币',   flag: '🇨🇳' },
  { code: 'USD', symbol: '$',   name: '美元',     flag: '🇺🇸' },
  { code: 'EUR', symbol: '€',   name: '欧元',     flag: '🇪🇺' },
  { code: 'GBP', symbol: '£',   name: '英镑',     flag: '🇬🇧' },
  { code: 'JPY', symbol: '¥',   name: '日元',     flag: '🇯🇵' },
  { code: 'KRW', symbol: '₩',   name: '韩元',     flag: '🇰🇷' },
  { code: 'HKD', symbol: 'HK$', name: '港币',     flag: '🇭🇰' },
  { code: 'TWD', symbol: 'NT$', name: '新台币',   flag: '🇹🇼' },
  { code: 'CAD', symbol: 'C$',  name: '加拿大元', flag: '🇨🇦' },
]

export function getCurrencyCode(): string {
  return wx.getStorageSync(CURRENCY_KEY) || 'CNY'
}

export function setCurrencyCode(code: string): void {
  wx.setStorageSync(CURRENCY_KEY, code)
}

export function getCurrencySymbol(code?: string): string {
  const target = code || getCurrencyCode()
  return CURRENCIES.find(c => c.code === target)?.symbol ?? '¥'
}
