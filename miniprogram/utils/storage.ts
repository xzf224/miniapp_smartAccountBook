import { IRecord, ICategories, IBudget, DEFAULT_CATEGORIES, IRecurringRule, IPendingDraft } from '../models/record'

const RECORDS_KEY = 'records'
const CATEGORIES_KEY = 'categories'
const BUDGETS_KEY = 'budgets'
const RECURRING_RULES_KEY = 'recurring_rules'
const PENDING_DRAFTS_KEY = 'pending_drafts'
const CATEGORY_META_KEY = 'category_meta'
const USER_PROFILE_KEY = 'user_profile'

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

export interface IAppBackupPayload {
  version: number
  exportedAt: number
  records: IRecord[]
  categories: ICategories
  budgets: IBudget[]
  recurringRules: IRecurringRule[]
  pendingDrafts: IPendingDraft[]
  userProfile: IUserProfile
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

export function saveBudgets(budgets: IBudget[]): void {
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

export function getBudgetAmount(year: number, month: number, type: '支出' | '收入', category: string): number {
  const budgets = getBudgets()
  const exact = budgets.find(
    b => b.year === year && b.month === month && b.type === type && b.category === category,
  )
  if (exact) return exact.amount
  const universal = budgets.find(b => b.month === 0 && b.type === type && b.category === category)
  return universal ? universal.amount : 0
}

// ---- 导出 ----

export function exportRecordsCSV(): string {
  const records = getRecords()
  if (records.length === 0) return ''
  // UTF-8 BOM 让 Excel / Numbers 正确识别中文
  const BOM = '\uFEFF'
  const header = '类型,类别,金额(元),日期,备注,创建时间'
  const rows = records.map(r =>
    `${r.type},${r.category},${(r.amount / 100).toFixed(2)},${r.date},"${r.note.replace(/"/g, '""')}",${new Date(r.createTime).toLocaleString()}`,
  )
  return BOM + [header, ...rows].join('\n')
}

export function exportBackupJSON(): string {
  const payload: IAppBackupPayload = {
    version: 1,
    exportedAt: Date.now(),
    records: getRecords(),
    categories: getCategories(),
    budgets: getBudgets(),
    recurringRules: getRecurringRules(),
    pendingDrafts: getPendingDrafts(),
    userProfile: getUserProfile(),
  }
  return JSON.stringify(payload, null, 2)
}

export function restoreBackupJSON(raw: string): boolean {
  const parsed = JSON.parse(raw || '{}') as Partial<IAppBackupPayload>
  if (!Array.isArray(parsed.records) || !parsed.categories || !Array.isArray(parsed.budgets)) {
    return false
  }

  saveRecords(parsed.records)
  saveCategories({
    '支出': Array.isArray(parsed.categories['支出']) ? parsed.categories['支出'] : [...DEFAULT_CATEGORIES['支出']],
    '收入': Array.isArray(parsed.categories['收入']) ? parsed.categories['收入'] : [...DEFAULT_CATEGORIES['收入']],
    '不计入收支': Array.isArray(parsed.categories['不计入收支']) ? parsed.categories['不计入收支'] : [...DEFAULT_CATEGORIES['不计入收支']],
  })
  saveBudgets(Array.isArray(parsed.budgets) ? parsed.budgets : [])
  saveRecurringRules(Array.isArray(parsed.recurringRules) ? parsed.recurringRules : [])
  savePendingDrafts(Array.isArray(parsed.pendingDrafts) ? parsed.pendingDrafts : [])
  saveUserProfile(parsed.userProfile || {})
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
