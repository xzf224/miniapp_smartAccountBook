import { IRecord } from '../models/record'
import { getBudgets, getCurrencyCode, getCurrencySymbol, getRecords } from './storage'

const BUDGET_ALERT_ENABLED_KEY = 'budgetAlertEnabled'
const BUDGET_ALERT_THRESHOLD_KEY = 'budgetAlertThreshold'
const BUDGET_ALERT_HISTORY_KEY = 'budgetAlertHistory'

type BudgetAlertLevel = 'threshold' | 'over'
type BudgetAlertScope = 'total' | 'category'

interface BudgetAlertHistoryItem {
  level: BudgetAlertLevel
  threshold: number
}

type BudgetAlertHistory = Record<string, BudgetAlertHistoryItem>

export interface BudgetAlert {
  scope: BudgetAlertScope
  level: BudgetAlertLevel
  year: number
  month: number
  currencyCode: string
  currencySymbol: string
  budgetName: string
  category?: string
  threshold: number
  percent: number
  spentFen: number
  budgetFen: number
  overFen: number
}

export interface BudgetAlertBanner {
  tone: 'warning' | 'danger'
  title: string
  text: string
}

function formatCurrency(fen: number): string {
  return (fen / 100).toFixed(2)
}

function getCurrentYearMonth() {
  const now = new Date()
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  }
}

function getAlertThreshold(): number {
  const rawThreshold = Number(wx.getStorageSync(BUDGET_ALERT_THRESHOLD_KEY) || 80)
  return Number.isFinite(rawThreshold)
    ? Math.min(100, Math.max(1, Math.round(rawThreshold)))
    : 80
}

function getAlertHistory(): BudgetAlertHistory {
  return wx.getStorageSync(BUDGET_ALERT_HISTORY_KEY) || {}
}

function saveAlertHistory(history: BudgetAlertHistory) {
  wx.setStorageSync(BUDGET_ALERT_HISTORY_KEY, history)
}

function getBudgetAlertKey(year: number, month: number, currencyCode: string, category: string = '__total__') {
  return JSON.stringify([year, month, currencyCode, category])
}

function getExactBudget(year: number, month: number, category: string): number {
  const entry = getBudgets().find(
    budget => budget.year === year
      && budget.month === month
      && budget.type === '支出'
      && budget.category === category,
  )
  return entry ? entry.amount : 0
}

function getMonthExpense(year: number, month: number, currencyCode: string, category?: string): number {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  return getRecords().reduce((sum, record) => {
    if (
      record.type !== '支出'
      || !record.date.startsWith(prefix)
      || (record.currency ?? 'CNY') !== currencyCode
      || (category && record.category !== category)
    ) {
      return sum
    }
    return sum + record.amount
  }, 0)
}

function buildBudgetAlert(
  year: number,
  month: number,
  currencyCode: string,
  threshold: number,
  category: string = '__total__',
): BudgetAlert | null {
  const budgetFen = getExactBudget(year, month, category)
  if (budgetFen <= 0) return null

  const spentFen = getMonthExpense(year, month, currencyCode, category === '__total__' ? undefined : category)
  const percent = Math.round((spentFen / budgetFen) * 100)
  const level: BudgetAlertLevel | null = spentFen > budgetFen
    ? 'over'
    : percent >= threshold
      ? 'threshold'
      : null

  if (!level) return null

  const scope: BudgetAlertScope = category === '__total__' ? 'total' : 'category'

  return {
    scope,
    level,
    year,
    month,
    currencyCode,
    currencySymbol: getCurrencySymbol(currencyCode),
    budgetName: scope === 'total' ? '本月总预算' : `${category}预算`,
    category: scope === 'category' ? category : undefined,
    threshold,
    percent,
    spentFen,
    budgetFen,
    overFen: Math.max(0, spentFen - budgetFen),
  }
}

function pickHigherPriorityAlert(current: BudgetAlert | null, next: BudgetAlert): BudgetAlert {
  if (!current) return next
  const currentPriority = current.level === 'over' ? 2 : 1
  const nextPriority = next.level === 'over' ? 2 : 1
  if (currentPriority !== nextPriority) {
    return currentPriority > nextPriority ? current : next
  }
  if (next.percent !== current.percent) {
    return next.percent > current.percent ? next : current
  }
  if (current.scope !== next.scope) {
    return next.scope === 'category' ? next : current
  }
  return current
}

export function checkBudgetAlertAfterRecordsSaved(records: IRecord[]): BudgetAlert | null {
  const alertEnabled = Boolean(wx.getStorageSync(BUDGET_ALERT_ENABLED_KEY))
  if (!alertEnabled) return null

  const threshold = getAlertThreshold()

  const { year: currentYear, month: currentMonth } = getCurrentYearMonth()
  const affectedKeys = new Set<string>()

  records.forEach((record) => {
    if (record.type !== '支出') return
    const [yearText, monthText] = record.date.split('-')
    const year = Number(yearText)
    const month = Number(monthText)
    if (year !== currentYear || month !== currentMonth) return
    const currencyCode = record.currency ?? 'CNY'
    affectedKeys.add(getBudgetAlertKey(year, month, currencyCode))
    affectedKeys.add(getBudgetAlertKey(year, month, currencyCode, record.category))
  })

  if (affectedKeys.size === 0) return null

  const history = getAlertHistory()
  const candidateAlerts: BudgetAlert[] = []

  for (const key of affectedKeys) {
    const [year, month, currencyCode, category] = JSON.parse(key) as [number, number, string, string]
    const alert = buildBudgetAlert(year, month, currencyCode, threshold, category)
    if (!alert) continue

    const prev = history[key]
    const thresholdChanged = prev?.threshold !== threshold
    const shouldNotify = alert.level === 'over'
      ? prev?.level !== 'over'
      : thresholdChanged
        ? prev?.level !== 'over'
        : prev?.level !== 'threshold' && prev?.level !== 'over'

    if (!shouldNotify) continue

    candidateAlerts.push(alert)
  }

  const finalAlert = candidateAlerts.reduce<BudgetAlert | null>(
    (current, next) => pickHigherPriorityAlert(current, next),
    null,
  )
  if (!finalAlert) return null

  history[getBudgetAlertKey(finalAlert.year, finalAlert.month, finalAlert.currencyCode, finalAlert.category || '__total__')] = {
    level: finalAlert.level,
    threshold,
  }
  saveAlertHistory(history)

  return finalAlert
}

export function getBudgetAlertForPeriod(
  year: number,
  month: number,
  currencyCode: string = getCurrencyCode(),
): BudgetAlert | null {
  const alertEnabled = Boolean(wx.getStorageSync(BUDGET_ALERT_ENABLED_KEY))
  if (!alertEnabled) return null

  const threshold = getAlertThreshold()
  const exactBudgets = getBudgets().filter(
    budget => budget.year === year
      && budget.month === month
      && budget.type === '支出'
      && budget.amount > 0,
  )

  return exactBudgets.reduce<BudgetAlert | null>((current, budget) => {
    const next = buildBudgetAlert(year, month, currencyCode, threshold, budget.category)
    if (!next) return current
    return pickHigherPriorityAlert(current, next)
  }, null)
}

export function getBudgetAlertBanner(alert: BudgetAlert): BudgetAlertBanner {
  if (alert.scope === 'category' && alert.level === 'over') {
    return {
      tone: 'danger',
      title: '分类预算已超支',
      text: `${alert.category}已超出预算 ${alert.currencySymbol}${formatCurrency(alert.overFen)}，当前已花 ${alert.currencySymbol}${formatCurrency(alert.spentFen)} / 预算 ${alert.currencySymbol}${formatCurrency(alert.budgetFen)}。`,
    }
  }

  if (alert.scope === 'category') {
    return {
      tone: 'warning',
      title: '分类预算提醒',
      text: `${alert.category}已达到预算的 ${alert.threshold}%，当前已花 ${alert.currencySymbol}${formatCurrency(alert.spentFen)}。`,
    }
  }

  if (alert.level === 'over') {
    return {
      tone: 'danger',
      title: '预算已超支',
      text: `当前超出 ${alert.currencySymbol}${formatCurrency(alert.overFen)}，已花 ${alert.currencySymbol}${formatCurrency(alert.spentFen)} / 总预算 ${alert.currencySymbol}${formatCurrency(alert.budgetFen)}。`,
    }
  }

  return {
    tone: 'warning',
    title: '预算提醒',
    text: `本月支出已达到总预算的 ${alert.threshold}%，当前已花 ${alert.currencySymbol}${formatCurrency(alert.spentFen)}。`,
  }
}

export function showBudgetAlertModal(alert: BudgetAlert, onComplete?: () => void) {
  const title = alert.scope === 'category'
    ? alert.level === 'over' ? '分类预算已超支' : '分类预算提醒'
    : alert.level === 'over' ? '预算已超支' : '预算提醒'
  const content = alert.scope === 'category'
    ? alert.level === 'over'
      ? `${alert.category}已超出预算 ${alert.currencySymbol}${formatCurrency(alert.overFen)}（已花 ${alert.currencySymbol}${formatCurrency(alert.spentFen)} / 预算 ${alert.currencySymbol}${formatCurrency(alert.budgetFen)}）。`
      : `${alert.category}已达到预算的 ${alert.threshold}%（已花 ${alert.currencySymbol}${formatCurrency(alert.spentFen)} / 预算 ${alert.currencySymbol}${formatCurrency(alert.budgetFen)}）。`
    : alert.level === 'over'
      ? `本月支出已超出总预算 ${alert.currencySymbol}${formatCurrency(alert.overFen)}（已花 ${alert.currencySymbol}${formatCurrency(alert.spentFen)} / 总预算 ${alert.currencySymbol}${formatCurrency(alert.budgetFen)}）。`
      : `本月支出已达到总预算的 ${alert.threshold}%（已花 ${alert.currencySymbol}${formatCurrency(alert.spentFen)} / 总预算 ${alert.currencySymbol}${formatCurrency(alert.budgetFen)}）。`

  wx.showModal({
    title,
    content,
    showCancel: false,
    confirmText: '知道了',
    success: () => {
      onComplete?.()
    },
  })
}
