// Mock storage 模块，让 getCategories() 直接返回默认类别（不依赖 wx.getStorageSync）
jest.mock('../miniprogram/utils/storage', () => ({
  getCategories: () => require('../miniprogram/models/record').DEFAULT_CATEGORIES,
}))

// Mock date 模块，固定 getToday() 返回值，让断言稳定可重复
jest.mock('../miniprogram/utils/date', () => ({
  ...jest.requireActual('../miniprogram/utils/date'),
  getToday: () => '2026-03-12',
}))

import { parseVoiceText, parseOCRResult } from '../miniprogram/utils/parser'

// ─── parseVoiceText ───────────────────────────────────────────────────────────

describe('parseVoiceText', () => {
  describe('单条记录识别', () => {
    test('已知关键词 → 正确类别', () => {
      const results = parseVoiceText('午餐30元')
      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({
        type: '支出',
        category: '餐饮',
        amount: 3000,
        note: '午餐',
        date: '2026-03-12',
      })
    })

    test('交通关键词', () => {
      const results = parseVoiceText('打车15块')
      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({ type: '支出', category: '交通', amount: 1500 })
    })

    test('服饰关键词', () => {
      const results = parseVoiceText('买衣服200')
      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({ type: '支出', category: '服饰', amount: 20000 })
    })

    test('收入关键词 → type 为收入', () => {
      const results = parseVoiceText('工资5000元')
      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({ type: '收入', category: '工资', amount: 500000 })
    })

    test('"发了" → 收入（工资发放场景）', () => {
      const results = parseVoiceText('今天发了1000块')
      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({ type: '收入', category: '工资' })
    })

    test('"发了红包" → 仍为支出（红包关键词优先）', () => {
      const results = parseVoiceText('发了红包500')
      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({ type: '支出', category: '发红包' })
    })

    test('"到账" → 收入', () => {
      const results = parseVoiceText('工资到账8000')
      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({ type: '收入' })
    })

    test('未知关键词 → 归入支出/其他', () => {
      const results = parseVoiceText('买了个东西50元')
      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({ type: '支出', category: '其他' })
    })

    test('小数金额精度正确', () => {
      const results = parseVoiceText('咖啡18.5元')
      expect(results).toHaveLength(1)
      expect(results[0].amount).toBe(1850)
    })
  })

  describe('多条记录', () => {
    test('逗号分隔 → 每段独立解析', () => {
      const results = parseVoiceText('午餐30元，打车15块，买衣服200')
      expect(results).toHaveLength(3)
      expect(results[0].category).toBe('餐饮')
      expect(results[1].category).toBe('交通')
      expect(results[2].category).toBe('服饰')
    })

    test('句号分隔', () => {
      const results = parseVoiceText('早餐10元。地铁5块。')
      expect(results).toHaveLength(2)
    })

    test('分号分隔', () => {
      const results = parseVoiceText('电影80元；奶茶28元')
      expect(results).toHaveLength(2)
      expect(results[0].category).toBe('娱乐')
      expect(results[1].category).toBe('餐饮')
    })

    test('混合分隔符', () => {
      const results = parseVoiceText('电费120元，水费30块。燃气50元')
      expect(results).toHaveLength(3)
      results.forEach(r => expect(r.category).toBe('生活缴费'))
    })
  })

  describe('边界情况', () => {
    test('无金额文本 → 空数组', () => {
      expect(parseVoiceText('今天心情很好')).toHaveLength(0)
    })

    test('空字符串 → 空数组', () => {
      expect(parseVoiceText('')).toHaveLength(0)
    })

    test('金额为零 → 过滤掉', () => {
      expect(parseVoiceText('买了东西0元')).toHaveLength(0)
    })

    test('纯数字无关键词 → 归入其他', () => {
      const results = parseVoiceText('100元')
      expect(results).toHaveLength(1)
      expect(results[0].category).toBe('其他')
    })

    test('date 字段为固定日期', () => {
      const results = parseVoiceText('午餐30元')
      expect(results[0].date).toBe('2026-03-12')
    })
  })
})

// ─── parseOCRResult ───────────────────────────────────────────────────────────

describe('parseOCRResult', () => {
  describe('合计行识别', () => {
    test('含"合计"时提取合计金额', () => {
      const text = '星巴克\n拿铁 38.00\n合计 38.00'
      const results = parseOCRResult(text)
      expect(results).toHaveLength(1)
      expect(results[0].amount).toBe(3800)
    })

    test('英文 TOTAL 识别', () => {
      const text = 'STARBUCKS\nLatte 38.00\nTOTAL 38.00'
      const results = parseOCRResult(text)
      expect(results).toHaveLength(1)
      expect(results[0].amount).toBe(3800)
    })

    test('"实付"优先级高于"合计"', () => {
      const text = '超市\n商品A 10.00\n合计 10.00\n会员折扣 -2.00\n实付 8.00'
      const results = parseOCRResult(text)
      expect(results[0].amount).toBe(800)
    })

    test('"实付"优先级高于"小计"', () => {
      const text = '便利店\n饮料 5.00\n食品 8.00\n小计 13.00\n实付 12.00'
      const results = parseOCRResult(text)
      expect(results[0].amount).toBe(1200)
    })
  })

  describe('无合计行时累加明细', () => {
    test('明细金额累加', () => {
      const text = '小吃店\n串串 12.00\n饮料 8.00'
      const results = parseOCRResult(text)
      expect(results).toHaveLength(1)
      expect(results[0].amount).toBe(2000)
    })

    test('整数价格也能识别', () => {
      const text = '水果摊\n苹果 10\n香蕉 6'
      const results = parseOCRResult(text)
      expect(results).toHaveLength(1)
      expect(results[0].amount).toBe(1600)
    })
  })

  describe('商家名识别', () => {
    test('从首行提取商家名', () => {
      const text = '星巴克\n拿铁 38.00\n合计 38.00'
      const results = parseOCRResult(text)
      expect(results[0].note).toBe('星巴克')
    })

    test('跳过含金额的行去找商家名', () => {
      const text = '12345\n全家便利\n饮料 8.00\n合计 8.00'
      const results = parseOCRResult(text)
      expect(results[0].note).toBe('全家便利')
    })
  })

  describe('边界情况', () => {
    test('空字符串 → 空数组', () => {
      expect(parseOCRResult('')).toHaveLength(0)
    })

    test('只有无意义行（无金额） → 空数组', () => {
      expect(parseOCRResult('谢谢惠顾\n欢迎下次光临')).toHaveLength(0)
    })

    test('date 字段为固定日期', () => {
      const results = parseOCRResult('超市\n合计 50.00')
      expect(results[0].date).toBe('2026-03-12')
    })
  })
})
