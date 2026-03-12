import { IRecord, RecordType, generateId, yuanToFen } from '../models/record'
import { getCategories } from './storage'
import { getToday } from './date'

interface ParsedRecord {
  type: RecordType
  category: string
  amount: number   // 分
  note: string
  date: string
}

const KEYWORD_CATEGORY_MAP: Record<string, { type: RecordType; category: string }> = {
  // ── 餐饮 ──────────────────────────────────────────────
  '早餐': { type: '支出', category: '餐饮' },
  '午餐': { type: '支出', category: '餐饮' },
  '晚餐': { type: '支出', category: '餐饮' },
  '夜宵': { type: '支出', category: '餐饮' },
  '宵夜': { type: '支出', category: '餐饮' },
  '吃饭': { type: '支出', category: '餐饮' },
  '聚餐': { type: '支出', category: '餐饮' },
  '请客': { type: '支出', category: '餐饮' },
  '外卖': { type: '支出', category: '餐饮' },
  '点餐': { type: '支出', category: '餐饮' },
  '饭': { type: '支出', category: '餐饮' },
  '餐': { type: '支出', category: '餐饮' },
  '面条': { type: '支出', category: '餐饮' },
  '包子': { type: '支出', category: '餐饮' },
  '馒头': { type: '支出', category: '餐饮' },
  '饺子': { type: '支出', category: '餐饮' },
  '火锅': { type: '支出', category: '餐饮' },
  '烧烤': { type: '支出', category: '餐饮' },
  '披萨': { type: '支出', category: '餐饮' },
  '汉堡': { type: '支出', category: '餐饮' },
  '奶茶': { type: '支出', category: '餐饮' },
  '咖啡': { type: '支出', category: '餐饮' },
  '果汁': { type: '支出', category: '餐饮' },
  '饮料': { type: '支出', category: '餐饮' },
  '啤酒': { type: '支出', category: '餐饮' },
  '水果': { type: '支出', category: '餐饮' },
  '零食': { type: '支出', category: '餐饮' },
  '蛋糕': { type: '支出', category: '餐饮' },
  '面包': { type: '支出', category: '餐饮' },
  // ── 交通 ──────────────────────────────────────────────
  '打车': { type: '支出', category: '交通' },
  '滴滴': { type: '支出', category: '交通' },
  '出租': { type: '支出', category: '交通' },
  '地铁': { type: '支出', category: '交通' },
  '公交': { type: '支出', category: '交通' },
  '公共交通': { type: '支出', category: '交通' },
  '骑车': { type: '支出', category: '交通' },
  '共享单车': { type: '支出', category: '交通' },
  '高铁': { type: '支出', category: '交通' },
  '火车': { type: '支出', category: '交通' },
  '汽车票': { type: '支出', category: '交通' },
  '飞机': { type: '支出', category: '交通' },
  '机票': { type: '支出', category: '交通' },
  '加油': { type: '支出', category: '交通' },
  '停车': { type: '支出', category: '交通' },
  '停车费': { type: '支出', category: '交通' },
  '过路费': { type: '支出', category: '交通' },
  '高速': { type: '支出', category: '交通' },
  '保险': { type: '支出', category: '交通' },
  '修车': { type: '支出', category: '交通' },
  '洗车': { type: '支出', category: '交通' },
  // ── 服饰 ──────────────────────────────────────────────
  '衣服': { type: '支出', category: '服饰' },
  '买衣': { type: '支出', category: '服饰' },
  '裤子': { type: '支出', category: '服饰' },
  '裙子': { type: '支出', category: '服饰' },
  '鞋': { type: '支出', category: '服饰' },
  '运动鞋': { type: '支出', category: '服饰' },
  '皮带': { type: '支出', category: '服饰' },
  '帽子': { type: '支出', category: '服饰' },
  '包包': { type: '支出', category: '服饰' },
  '内衣': { type: '支出', category: '服饰' },
  // ── 购物 ──────────────────────────────────────────────
  '超市': { type: '支出', category: '购物' },
  '便利店': { type: '支出', category: '购物' },
  '菜市场': { type: '支出', category: '购物' },
  '买菜': { type: '支出', category: '购物' },
  '淘宝': { type: '支出', category: '购物' },
  '天猫': { type: '支出', category: '购物' },
  '京东': { type: '支出', category: '购物' },
  '拼多多': { type: '支出', category: '购物' },
  '抖音商城': { type: '支出', category: '购物' },
  '亚马逊': { type: '支出', category: '购物' },
  '网购': { type: '支出', category: '购物' },
  '购物': { type: '支出', category: '购物' },
  '数码': { type: '支出', category: '购物' },
  '手机': { type: '支出', category: '购物' },
  '电脑': { type: '支出', category: '购物' },
  '耳机': { type: '支出', category: '购物' },
  '家具': { type: '支出', category: '购物' },
  '家电': { type: '支出', category: '购物' },
  // ── 服务 ──────────────────────────────────────────────
  '理发': { type: '支出', category: '服务' },
  '美发': { type: '支出', category: '服务' },
  '美甲': { type: '支出', category: '服务' },
  '美容': { type: '支出', category: '服务' },
  '按摩': { type: '支出', category: '服务' },
  '洗衣': { type: '支出', category: '服务' },
  '干洗': { type: '支出', category: '服务' },
  '快递': { type: '支出', category: '服务' },
  '邮费': { type: '支出', category: '服务' },
  // ── 娱乐 ──────────────────────────────────────────────
  '电影': { type: '支出', category: '娱乐' },
  '演唱会': { type: '支出', category: '娱乐' },
  '音乐节': { type: '支出', category: '娱乐' },
  '话剧': { type: '支出', category: '娱乐' },
  '展览': { type: '支出', category: '娱乐' },
  '博物馆': { type: '支出', category: '娱乐' },
  '景区': { type: '支出', category: '娱乐' },
  '门票': { type: '支出', category: '娱乐' },
  '游乐园': { type: '支出', category: '娱乐' },
  '游戏': { type: '支出', category: '娱乐' },
  '游戏充值': { type: '支出', category: '娱乐' },
  'KTV': { type: '支出', category: '娱乐' },
  '唱歌': { type: '支出', category: '娱乐' },
  '桌游': { type: '支出', category: '娱乐' },
  '健身': { type: '支出', category: '娱乐' },
  '游泳': { type: '支出', category: '娱乐' },
  '旅游': { type: '支出', category: '娱乐' },
  '酒店': { type: '支出', category: '娱乐' },
  '民宿': { type: '支出', category: '娱乐' },
  // ── 生活缴费 ──────────────────────────────────────────
  '电费': { type: '支出', category: '生活缴费' },
  '水费': { type: '支出', category: '生活缴费' },
  '燃气': { type: '支出', category: '生活缴费' },
  '煤气': { type: '支出', category: '生活缴费' },
  '房租': { type: '支出', category: '生活缴费' },
  '物业': { type: '支出', category: '生活缴费' },
  '宽带': { type: '支出', category: '生活缴费' },
  '网费': { type: '支出', category: '生活缴费' },
  '话费': { type: '支出', category: '生活缴费' },
  '流量': { type: '支出', category: '生活缴费' },
  '充值': { type: '支出', category: '生活缴费' },
  '暖气': { type: '支出', category: '生活缴费' },
  '供暖': { type: '支出', category: '生活缴费' },
  '车贷': { type: '支出', category: '生活缴费' },
  '房贷': { type: '支出', category: '生活缴费' },
  '还款': { type: '支出', category: '生活缴费' },
  '保险费': { type: '支出', category: '生活缴费' },
  // ── 医疗 ──────────────────────────────────────────────
  '看病': { type: '支出', category: '医疗' },
  '就医': { type: '支出', category: '医疗' },
  '挂号': { type: '支出', category: '医疗' },
  '门诊': { type: '支出', category: '医疗' },
  '住院': { type: '支出', category: '医疗' },
  '手术': { type: '支出', category: '医疗' },
  '药': { type: '支出', category: '医疗' },
  '买药': { type: '支出', category: '医疗' },
  '体检': { type: '支出', category: '医疗' },
  '疫苗': { type: '支出', category: '医疗' },
  '牙科': { type: '支出', category: '医疗' },
  '眼镜': { type: '支出', category: '医疗' },
  // ── 教育 ──────────────────────────────────────────────
  '学费': { type: '支出', category: '教育' },
  '补课': { type: '支出', category: '教育' },
  '培训': { type: '支出', category: '教育' },
  '课程': { type: '支出', category: '教育' },
  '书本': { type: '支出', category: '教育' },
  '买书': { type: '支出', category: '教育' },
  '文具': { type: '支出', category: '教育' },
  '考试': { type: '支出', category: '教育' },
  '报名费': { type: '支出', category: '教育' },
  // ── 红包 / 转账 ───────────────────────────────────────
  '红包': { type: '支出', category: '发红包' },
  '转账': { type: '支出', category: '转账' },
  '还钱': { type: '支出', category: '转账' },
  '借钱': { type: '支出', category: '转账' },
  '礼金': { type: '支出', category: '发红包' },
  '份子钱': { type: '支出', category: '发红包' },
  // ── 收入 ──────────────────────────────────────────────
  '工资': { type: '收入', category: '工资' },
  '薪资': { type: '收入', category: '工资' },
  '月薪': { type: '收入', category: '工资' },
  '奖金': { type: '收入', category: '奖金' },
  '绩效': { type: '收入', category: '奖金' },
  '年终奖': { type: '收入', category: '奖金' },
  '提成': { type: '收入', category: '奖金' },
  '兼职': { type: '收入', category: '工资' },
  '稿费': { type: '收入', category: '工资' },
  '报销': { type: '收入', category: '报销' },
  '退款': { type: '收入', category: '退款' },
  '退货': { type: '收入', category: '退款' },
  '收红包': { type: '收入', category: '其他收入' },
  '收到': { type: '收入', category: '其他收入' },  // "收到1000" → 收入
  '到账': { type: '收入', category: '工资' },       // "工资到账5000" → 收入
  '发了': { type: '收入', category: '工资' },       // "今天发了1000" → 收入（发红包已在支出区优先匹配）
  '利息': { type: '收入', category: '其他收入' },
  '理财': { type: '收入', category: '其他收入' },
  '投资': { type: '收入', category: '其他收入' },
  '股票': { type: '收入', category: '其他收入' },
  '分红': { type: '收入', category: '其他收入' },
  '租金': { type: '收入', category: '其他收入' },
  '补贴': { type: '收入', category: '其他收入' },
}

// 数字中文映射
const CN_NUM: Record<string, number> = {
  '零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
  '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
  '十': 10, '百': 100, '千': 1000, '万': 10000,
}

export function parseCNNumber(s: string): number | null {
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s)
  // 简单中文数字解析（十几，几十等）
  let result = 0
  let cur = 0
  for (const ch of s) {
    const n = CN_NUM[ch]
    if (n === undefined) return null
    if (n >= 10) {
      if (cur === 0) cur = 1
      result += cur * n
      cur = 0
    } else {
      cur = n
    }
  }
  result += cur
  return result || null
}

/**
 * 解析语音识别文本，提取多条记录。
 * 支持格式: "午餐30元，打车15块，买衣服200"
 */
export function parseVoiceText(text: string): ParsedRecord[] {
  const cats = getCategories()
  // 构建用户自定义类别关键词表（补充默认映射中没有的）
  const userMap = { ...KEYWORD_CATEGORY_MAP }
  const allTypes: RecordType[] = ['支出', '收入', '不计入收支']
  for (const type of allTypes) {
    for (const cat of cats[type]) {
      if (!userMap[cat]) {
        userMap[cat] = { type: type as RecordType, category: cat }
      }
    }
  }

  // 按标点分割
  const segments = text.split(/[，。；,;！!？?、\n]+/).filter(s => s.trim())
  const today = getToday()
  const results: ParsedRecord[] = []

  for (const seg of segments) {
    const trimmed = seg.trim()
    if (!trimmed) continue

    // 匹配数字金额（支持中文数字）
    const numMatch = trimmed.match(/(\d+(?:\.\d{1,2})?)\s*(?:元|块|¥)?/)
    if (!numMatch) continue
    const amount = parseFloat(numMatch[1])
    if (!amount || amount <= 0) continue

    // 提取关键词部分（金额之前的文字）
    const keyword = trimmed.slice(0, numMatch.index).trim()

    // 匹配类别
    let matched: { type: RecordType; category: string } | null = null
    for (const key of Object.keys(userMap)) {
      if (keyword.includes(key)) {
        matched = userMap[key]
        break
      }
    }

    results.push({
      type: matched ? matched.type : '支出',
      category: matched ? matched.category : '其他',
      amount: yuanToFen(amount),
      note: keyword,
      date: today,
    })
  }

  return results
}

/**
 * 解析 OCR 识别结果文本，提取消费总额和商家名称。
 * 只生成一条记录：总额作为金额，商家名（若识别到）放入备注。
 */
export function parseOCRResult(text: string): ParsedRecord[] {
  const today = getToday()
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return []

  // 金额正则：支持 ¥ 和 $ 前缀，以及无前缀
  const priceRe = /[¥$]?\s*(\d+(?:\.\d{1,2})?)\s*$/

  // 1. 提取消费总额，优先级：
  //   1 = 实付 / AMOUNT / AMOUNT PAID（最终付款金额）
  //   2 = 应付 / TOTAL DUE
  //   3 = 合计 / 总计 / TOTAL（注意 \b 避免 SUBTOTAL 误匹配）
  //   4 = 小计 / SUBTOTAL
  const totalPatterns = [
    { re: /实付|\bAMOUNT\b|amount paid/i, priority: 1 },
    { re: /应付|total[\s_-]*due/i, priority: 2 },
    { re: /合计|总计|\bTOTAL\b/i, priority: 3 },
    { re: /小计|subtotal/i, priority: 4 },
  ]
  // 汇总行关键词（用于明细累加时跳过）
  const totalKeywordRe = /实付|应付|合计|总计|小计|\bAMOUNT\b|\bTOTAL\b|subtotal/i
  // 明细行排除关键词（折扣/税等不应计入明细）
  const detailExcludeRe = /折扣|优惠|积分|满减|抹零|找零|税|discount|tax|point|coupon/i

  let totalAmount = 0
  let bestPriority = 999

  // 第一轮：单行扫描（关键词和金额在同一行）
  for (const line of lines) {
    const m = line.match(priceRe)
    if (!m) continue
    const amount = parseFloat(m[1])
    if (!amount || amount < 0.1 || amount > 50000) continue
    for (const { re, priority } of totalPatterns) {
      if (re.test(line) && priority < bestPriority) {
        totalAmount = amount
        bestPriority = priority
        break
      }
    }
  }

  // 第二轮：双行扫描（关键词在第 i 行，金额在第 i+1 行）
  // Costco 等小票有时 TOTAL 和金额分两行输出
  for (let i = 0; i < lines.length - 1; i++) {
    const keyLine = lines[i]
    const nextLine = lines[i + 1]
    // 当前行有关键词但无金额，且下一行是纯金额行
    if (keyLine.match(priceRe)) continue              // 已在第一轮处理
    const nextM = nextLine.match(/^[¥$]?\s*(\d+(?:\.\d{1,2})?)\s*$/)  // 下一行纯金额
    if (!nextM) continue
    const amount = parseFloat(nextM[1])
    if (!amount || amount < 0.1 || amount > 50000) continue
    for (const { re, priority } of totalPatterns) {
      if (re.test(keyLine) && priority < bestPriority) {
        totalAmount = amount
        bestPriority = priority
        break
      }
    }
  }

  // 没找到任何合计关键词 → 图片可能不完整，将明细金额累加
  if (totalAmount === 0) {
    let sum = 0
    for (const line of lines) {
      if (totalKeywordRe.test(line)) continue    // 跳过汇总行（避免重复计入）
      if (detailExcludeRe.test(line)) continue   // 跳过折扣/税等非商品行
      const m = line.match(priceRe)
      if (!m) continue
      const amount = parseFloat(m[1])
      if (amount >= 0.1 && amount <= 50000) sum += amount
    }
    // 将累加结果四舍五入到分
    totalAmount = Math.round(sum * 100) / 100
  }

  if (totalAmount === 0) return []

  // 2. 识别商家名：取前 8 行中第一个符合条件的行
  // 跳过含金额、含流水/联系信息、纯数字/条形码、checkout 等行
  const metaRe = /日期|时间|流水|单号|订单|电话|地址|谢谢|欢迎|收银|操作员|发票|税率|date|time|tel|phone|address|receipt|invoice|cashier|member|barcode|checkout|self.?check/i
  let merchantName = ''
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const line = lines[i]
    if (/\d+\.\d{2}/.test(line)) continue        // 含小数金额，跳过
    if (/^\d[\d\s\-#]+$/.test(line)) continue    // 纯数字/条形码行，跳过
    if (/#\d+/.test(line)) continue               // 含门店编号（如 #151），跳过
    if (/\b[A-Z]\d[A-Z]\s?\d[A-Z]\d/.test(line)) continue  // 含加拿大邮编（如 L6G 1A6），跳过
    if (metaRe.test(line)) continue               // 含流水/联系/收银台信息，跳过
    if (line.length > 30) continue                // 太长可能是地址，跳过
    if (line.length < 2) continue                 // 太短，跳过
    merchantName = line
    break
  }

  // 3. 从商家名推断类别
  let matchedType: RecordType = '支出'
  let matchedCategory = '购物'
  for (const key of Object.keys(KEYWORD_CATEGORY_MAP)) {
    if (merchantName.includes(key)) {
      matchedType = KEYWORD_CATEGORY_MAP[key].type
      matchedCategory = KEYWORD_CATEGORY_MAP[key].category
      break
    }
  }

  return [{
    type: matchedType,
    category: matchedCategory,
    amount: yuanToFen(totalAmount),
    note: merchantName,
    date: today,
  }]
}

/** 将 ParsedRecord 转为完整 IRecord */
export function parsedToRecord(parsed: ParsedRecord): IRecord {
  const now = Date.now()
  return {
    id: generateId(),
    type: parsed.type,
    category: parsed.category,
    amount: parsed.amount,
    date: parsed.date,
    note: parsed.note,
    createTime: now,
    updateTime: now,
  }
}
