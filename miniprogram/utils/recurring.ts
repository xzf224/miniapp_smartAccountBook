import { IRecurringRule, IPendingDraft, generateId } from '../models/record'
import {
  getRecurringRules,
  saveRecurringRules,
  getPendingDrafts,
  savePendingDrafts,
} from './storage'

const MAX_CATCHUP = 3 // 最多补生成最近 3 次，防止长期未打开时产生大量草稿

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getToday(): string {
  return toDateStr(new Date())
}

/**
 * 计算 rule 在 (afterStr, upToStr] 区间内的所有到期日期（不含 afterStr 当天）
 */
function getDueDates(rule: IRecurringRule, afterStr: string, upToStr: string): string[] {
  const result: string[] = []
  const after = new Date(afterStr + 'T00:00:00')
  const upto = new Date(upToStr + 'T00:00:00')
  const ruleStart = new Date(rule.startDate + 'T00:00:00')

  // effectiveAfter = max(after, ruleStart-1)，确保不生成 startDate 之前的日期
  const effectiveAfter = after >= ruleStart ? after : new Date(ruleStart.getTime() - 86400000)

  if (effectiveAfter >= upto) return result

  switch (rule.frequency) {
    case 'daily': {
      const cur = new Date(effectiveAfter)
      cur.setDate(cur.getDate() + 1)
      while (cur <= upto) {
        const ds = toDateStr(cur)
        if (!rule.endDate || ds <= rule.endDate) result.push(ds)
        cur.setDate(cur.getDate() + 1)
      }
      break
    }

    case 'weekly': {
      const targetDow = rule.dayOfWeek ?? 1
      const cur = new Date(effectiveAfter)
      cur.setDate(cur.getDate() + 1)
      // 前进到目标星期
      const diff = (targetDow - cur.getDay() + 7) % 7
      cur.setDate(cur.getDate() + diff)
      while (cur <= upto) {
        const ds = toDateStr(cur)
        if (ds >= rule.startDate && (!rule.endDate || ds <= rule.endDate)) result.push(ds)
        cur.setDate(cur.getDate() + 7)
      }
      break
    }

    case 'monthly': {
      const targetDom = rule.dayOfMonth ?? 1
      const cur = new Date(effectiveAfter)
      cur.setDate(cur.getDate() + 1)
      while (cur <= upto) {
        const year = cur.getFullYear()
        const month = cur.getMonth()
        const lastDay = new Date(year, month + 1, 0).getDate()
        const actualDay = Math.min(targetDom, lastDay)
        const candidate = new Date(year, month, actualDay)
        if (candidate <= effectiveAfter) {
          // 本月日期已经过了 effectiveAfter，跳到下月
          cur.setFullYear(year, month + 1, 1)
          continue
        }
        if (candidate > upto) break
        const ds = toDateStr(candidate)
        if (ds >= rule.startDate && (!rule.endDate || ds <= rule.endDate)) result.push(ds)
        cur.setFullYear(year, month + 1, 1)
      }
      break
    }

    case 'yearly': {
      const targetMonth = (rule.monthOfYear ?? 1) - 1 // 0-indexed
      const targetDom = rule.dayOfMonth ?? 1
      const cur = new Date(effectiveAfter)
      cur.setDate(cur.getDate() + 1)
      while (cur <= upto) {
        const year = cur.getFullYear()
        const candidate = new Date(year, targetMonth, targetDom)
        if (candidate <= effectiveAfter) {
          cur.setFullYear(year + 1, 0, 1)
          continue
        }
        if (candidate > upto) break
        const ds = toDateStr(candidate)
        if (ds >= rule.startDate && (!rule.endDate || ds <= rule.endDate)) result.push(ds)
        cur.setFullYear(year + 1, 0, 1)
      }
      break
    }
  }

  return result
}

/**
 * 在 app 启动或首页 show 时调用，检查所有定期规则并生成待确认草稿
 */
export function checkRecurringRules(): void {
  const today = getToday()
  const rules = getRecurringRules()
  if (rules.length === 0) return

  const existingDrafts = getPendingDrafts()
  const newDrafts: IPendingDraft[] = []

  const updatedRules = rules.map(rule => {
    if (!rule.enabled) return rule
    if (today < rule.startDate) return rule
    if (rule.endDate && today > rule.endDate) return rule

    const dueDates = getDueDates(rule, rule.lastGeneratedDate, today)
    // 防爆炸：最多补充最近 MAX_CATCHUP 次
    const limitedDates = dueDates.slice(-MAX_CATCHUP)

    for (const date of limitedDates) {
      const alreadyExists =
        existingDrafts.some(d => d.ruleId === rule.id && d.date === date) ||
        newDrafts.some(d => d.ruleId === rule.id && d.date === date)
      if (!alreadyExists) {
        newDrafts.push({
          id: generateId(),
          ruleId: rule.id,
          ruleName: rule.name,
          type: rule.type,
          category: rule.category,
          amount: rule.amount,
          note: rule.note,
          date,
          generatedAt: Date.now(),
        })
      }
    }

    return { ...rule, lastGeneratedDate: today }
  })

  if (newDrafts.length > 0) {
    savePendingDrafts([...existingDrafts, ...newDrafts])
  }
  saveRecurringRules(updatedRules)
}
