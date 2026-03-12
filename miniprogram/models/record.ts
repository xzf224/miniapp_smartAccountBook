export type RecordType = '收入' | '支出' | '不计入收支'

export interface IRecord {
  id: string
  type: RecordType
  category: string
  amount: number       // 单位: 分（整数，避免浮点精度问题）
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

export interface IBudget {
  year: number
  month: number        // 0 = 每月通用
  type: '支出' | '收入'
  category: string     // '__total__' = 该类型总预算
  amount: number       // 分
}

export const CATEGORY_COLORS: Record<string, string> = {
  // 支出
  '餐饮': '#FF8533', '交通': '#4A9EFF', '服饰': '#FF6B9D', '购物': '#9B59B6',
  '服务': '#2ECC71', '教育': '#3498DB', '娱乐': '#E74C3C', '运动': '#27AE60',
  '生活缴费': '#F39C12', '旅行': '#1ABC9C', '宠物': '#E67E22', '医疗': '#E74C3C',
  '保险': '#2980B9', '公益': '#E84393', '发红包': '#E74C3C', '转账': '#95A5A6',
  '亲属卡': '#3498DB', '其他人情': '#F39C12', '退还': '#2ECC71', '其他': '#95A5A6', 
  // 收入
  '工资': '#27AE60', '奖金': '#F1C40F', '兼职': '#2ECC71', '报销': '#3498DB',
  '退款': '#1ABC9C', '投资': '#9B59B6', '红包': '#E74C3C',
  // 不计入收支
  '借入': '#95A5A6', '借出': '#BDC3C7', '理财转入': '#2ECC71',
  '理财转出': '#E67E22', '信用卡还款': '#E74C3C', '余额互转': '#3498DB',
}

export const CATEGORY_ICONS: Record<string, string> = {
  // 支出
  '餐饮': '餐', '交通': '车', '服饰': '衣', '购物': '购',
  '服务': '务', '教育': '育', '娱乐': '娱', '运动': '动',
  '生活缴费': '水', '旅行': '旅', '宠物': '宰', '医疗': '医',
  '保险': '保', '公益': '益', '发红包': '包', '转账': '转',
  '亲属卡': '卡', '其他人情': '情', '退还': '退','其他': '他', 
  // 收入
  '工资': '薪', '奖金': '奖', '兼职': '兆', '报销': '销',
  '退款': '退', '投资': '投', '红包': '红',
  // 不计入收支
  '借入': '借', '借出': '出', '理财转入': '财',
  '理财转出': '理', '信用卡还款': '还', '余额互转': '互',
}

export const DEFAULT_CATEGORIES: ICategories = {
  '支出': [
    '餐饮', '交通', '服饰', '购物', '服务', '教育', '娱乐', '运动',
    '生活缴费', '旅行', '宠物', '医疗', '保险', '公益', '发红包', '转账',
    '亲属卡', '其他人情', '退还','其他', 
  ],
  '收入': ['工资', '奖金', '兼职', '报销', '退款', '投资', '红包', '其他'],
  '不计入收支': ['借入', '借出', '理财转入', '理财转出', '信用卡还款', '余额互转'],
}

export const RECORD_TYPES: RecordType[] = ['支出', '收入', '不计入收支']

export function yuanToFen(yuan: number): number {
  return Math.round(yuan * 100)
}

export function fenToYuan(fen: number): string {
  return (fen / 100).toFixed(2)
}

export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
