import { yuanToFen, fenToYuan, generateId } from '../miniprogram/models/record'

describe('yuanToFen', () => {
  test('整数转换', () => expect(yuanToFen(10)).toBe(1000))
  test('1元 = 100分', () => expect(yuanToFen(1)).toBe(100))
  test('小数金额', () => expect(yuanToFen(9.99)).toBe(999))
  test('两位小数', () => expect(yuanToFen(0.01)).toBe(1))
  test('消除浮点精度问题（0.1+0.2）', () => expect(yuanToFen(0.1 + 0.2)).toBe(30))
  test('零值', () => expect(yuanToFen(0)).toBe(0))
  test('大金额', () => expect(yuanToFen(9999.99)).toBe(999999))
})

describe('fenToYuan', () => {
  test('整分值显示两位小数', () => expect(fenToYuan(1000)).toBe('10.00'))
  test('非整分值', () => expect(fenToYuan(999)).toBe('9.99'))
  test('零值', () => expect(fenToYuan(0)).toBe('0.00'))
  test('单分', () => expect(fenToYuan(1)).toBe('0.01'))
  test('大金额', () => expect(fenToYuan(999999)).toBe('9999.99'))
})

describe('generateId', () => {
  test('返回字符串', () => expect(typeof generateId()).toBe('string'))
  test('格式：时间戳_随机串', () => expect(generateId()).toMatch(/^\d+_[a-z0-9]+$/))
  test('连续两次调用结果不同', () => {
    const ids = new Set([generateId(), generateId(), generateId(), generateId(), generateId()])
    expect(ids.size).toBe(5)
  })
  test('包含当前时间戳量级', () => {
    const id = generateId()
    const ts = parseInt(id.split('_')[0], 10)
    expect(ts).toBeGreaterThan(1_000_000_000_000) // 2001年以后
  })
})
