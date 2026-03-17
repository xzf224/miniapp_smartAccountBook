import { addCategory, getCategories, setCategoryMeta, upsertBudget } from '../../utils/storage'
import { ICategories, IBudget, yuanToFen } from '../../models/record'

type CategoryType = '支出' | '收入'

const TYPES: CategoryType[] = ['支出', '收入']

const ICON_OPTIONS = [
  '⌂', '车', '礼', '音', '相',
  '剪', '宠', '医', '花', '伞',
  '镜', '耳', '旅', '心', '冠',
  '钥', '锚', '羽', '星', '游',
]

const COLOR_OPTIONS = [
  '#FF4D4F', '#FF8A00', '#34C759', '#3B82F6',
  '#8B5CF6', '#EC4899', '#F59E0B', '#6B7280',
]

function createSoftBackground(color: string): string {
  const hex = color.replace('#', '')
  if (hex.length !== 6) return '#FFF5E8'

  const red = parseInt(hex.slice(0, 2), 16)
  const green = parseInt(hex.slice(2, 4), 16)
  const blue = parseInt(hex.slice(4, 6), 16)
  const mix = (channel: number) => Math.round(channel * 0.12 + 255 * 0.88)

  return `rgb(${mix(red)}, ${mix(green)}, ${mix(blue)})`
}

Page({
  data: {
    typeIndex: 0,
    types: TYPES,
    selectedIcon: ICON_OPTIONS[0],
    selectedColor: COLOR_OPTIONS[1],
    newName: '',
    budgetYuan: '',
    iconOptions: ICON_OPTIONS,
    colorOptions: COLOR_OPTIONS,
  },

  onLoad(options: Record<string, string>) {
    const parsedTypeIndex = Number(options.typeIndex)
    this.setData({
      typeIndex: parsedTypeIndex === 1 ? 1 : 0,
    })
  },

  onTypeChange(e: WechatMiniprogram.TouchEvent) {
    const typeIndex = Number((e.currentTarget.dataset || {}).index)
    this.setData({ typeIndex })
  },

  onSelectIcon(e: WechatMiniprogram.TouchEvent) {
    const selectedIcon = (e.currentTarget.dataset || {}).icon as string
    this.setData({ selectedIcon })
  },

  onSelectColor(e: WechatMiniprogram.TouchEvent) {
    const selectedColor = (e.currentTarget.dataset || {}).color as string
    this.setData({ selectedColor })
  },

  onNameInput(e: WechatMiniprogram.Input) {
    this.setData({ newName: e.detail.value })
  },

  onBudgetInput(e: WechatMiniprogram.Input) {
    const raw = e.detail.value.replace(/[^\d.]/g, '')
    const normalized = raw
      .replace(/^\./, '')
      .replace(/(\..*)\./g, '$1')
      .replace(/^(\d+)\.(\d{0,2}).*$/, '$1.$2')
    this.setData({ budgetYuan: normalized })
  },

  onSaveCategory() {
    const { newName, typeIndex, selectedIcon, selectedColor, budgetYuan } = this.data
    const trimmed = newName.trim()
    if (!trimmed) {
      wx.showToast({ title: '请输入分类名称', icon: 'none' })
      return
    }

    const type: keyof ICategories = TYPES[typeIndex]
    const categories = getCategories()
    if ((categories[type] || []).includes(trimmed)) {
      wx.showToast({ title: '分类已存在', icon: 'none' })
      return
    }

    if (budgetYuan !== '') {
      const value = parseFloat(budgetYuan)
      if (Number.isNaN(value) || value < 0) {
        wx.showToast({ title: '预算金额无效', icon: 'none' })
        return
      }
    }

    const added = addCategory(type, trimmed)
    if (!added) {
      wx.showToast({ title: '分类已存在', icon: 'none' })
      return
    }

    setCategoryMeta(trimmed, {
      icon: selectedIcon,
      color: selectedColor,
      bgColor: createSoftBackground(selectedColor),
    })

    if (budgetYuan !== '') {
      const value = parseFloat(budgetYuan)
      const budget: IBudget = {
        year: 0,
        month: 0,
        type,
        category: trimmed,
        amount: yuanToFen(value),
      }
      upsertBudget(budget)
    }

    wx.showToast({ title: '分类已添加', icon: 'success' })
    setTimeout(() => {
      wx.navigateBack({ delta: 1 })
    }, 320)
  },
})
