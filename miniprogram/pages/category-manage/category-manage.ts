import { getCategories, addCategory, deleteCategory, getCategoryMeta, setCategoryMeta } from '../../utils/storage'
import { CATEGORY_COLORS, CATEGORY_ICONS, ICategories, DEFAULT_CATEGORIES } from '../../models/record'

interface CategoryDisplayItem {
  name: string
  icon: string
  isDefault: boolean
  color: string
  bgColor: string
}

const PASTEL_BACKGROUNDS = [
  '#FFF2E8', '#EEF4FF', '#F4EDFF', '#EAFBF1',
  '#EDF5FF', '#FFF0F4', '#FFF8E5', '#EEFBEF',
]

const ICON_OPTIONS = ['🍔', '🚗', '👗', '🛍️', '🏠', '🎮', '📚', '💊',
  '✈️', '🐶', '💰', '🎁', '🏋️', '☕', '🎵', '🌿',
  '🔧', '💡', '🌈', '⭐', '❤️', '🎯', '🍕', '🚀']

const COLOR_OPTIONS = [
  '#FF8A00', '#FF6B9D', '#E74C3C', '#F39C12',
  '#27AE60', '#2ECC71', '#1ABC9C', '#3498DB',
  '#4A9EFF', '#9B59B6', '#E84393', '#95A5A6',
]

Component({
  data: {
    typeIndex: 0,
    types: ['支出', '收入'],
    categories: [] as CategoryDisplayItem[],
    newName: '',
    showAddBox: false,
    selectedIcon: '⭐',
    selectedColor: '#FF8A00',
    iconOptions: ICON_OPTIONS,
    colorOptions: COLOR_OPTIONS,
  },

  lifetimes: {
    attached() {
      this.loadCategories()
    }
  },

  methods: {
    loadCategories() {
      const { typeIndex } = this.data
      const cats = getCategories()
      const meta = getCategoryMeta()
      const list: string[] = typeIndex === 0 ? cats['支出'] : cats['收入']
      const defaults = typeIndex === 0 ? DEFAULT_CATEGORIES['支出'] : DEFAULT_CATEGORIES['收入']
      const categories: CategoryDisplayItem[] = list.map((name: string, index: number) => {
        const customMeta = meta[name]
        return {
          name,
          icon: customMeta?.icon || CATEGORY_ICONS[name] || '他',
          isDefault: defaults.includes(name),
          color: customMeta?.color || CATEGORY_COLORS[name] || '#FF8A00',
          bgColor: customMeta?.bgColor || PASTEL_BACKGROUNDS[index % PASTEL_BACKGROUNDS.length],
        }
      })
      this.setData({ categories })
    },

    onTypeChange(e: WechatMiniprogram.CustomEvent) {
      const typeIndex = Number(e.currentTarget.dataset.index)
      this.setData({ typeIndex, newName: '' }, () => this.loadCategories())
    },

    onNameInput(e: WechatMiniprogram.CustomEvent) {
      this.setData({ newName: e.detail.value })
    },

    onSelectIcon(e: WechatMiniprogram.CustomEvent) {
      this.setData({ selectedIcon: e.currentTarget.dataset.icon })
    },

    onSelectColor(e: WechatMiniprogram.CustomEvent) {
      this.setData({ selectedColor: e.currentTarget.dataset.color })
    },

    onAddCategory() {
      const { newName, typeIndex, selectedIcon, selectedColor } = this.data
      const trimmed = newName.trim()
      if (!trimmed) {
        wx.showToast({ title: '请输入分类名', icon: 'none' })
        return
      }
      const type: keyof ICategories = typeIndex === 0 ? '支出' : '收入'
      const allCats = getCategories()
      const list: string[] = allCats[type]
      if (list.includes(trimmed)) {
        wx.showToast({ title: '分类已存在', icon: 'none' })
        return
      }
      addCategory(type, trimmed)
      setCategoryMeta(trimmed, {
        icon: selectedIcon,
        color: selectedColor,
        bgColor: '#F8F4FF',
      })
      this.setData({ newName: '', showAddBox: false, selectedIcon: '⭐', selectedColor: '#FF8A00' })
      this.loadCategories()
    },

    onToggleAddBox() {
      this.setData({ showAddBox: !this.data.showAddBox })
    },

    onDeleteCategory(e: WechatMiniprogram.CustomEvent) {
      const name = e.currentTarget.dataset.name as string
      const { typeIndex } = this.data
      const cats = this.data.categories
      const item = cats.find(c => c.name === name)
      if (item && item.isDefault) {
        wx.showToast({ title: '系统分类不可删除', icon: 'none' })
        return
      }
      wx.showModal({
        title: '确认删除',
        content: `删除分类"${name}"？该分类下的记录不受影响。`,
        confirmText: '删除',
        confirmColor: '#ff4d4f',
        success: (res) => {
          if (res.confirm) {
            const cats2 = getCategories()
            const type2: keyof typeof cats2 = typeIndex === 0 ? '支出' : '收入'
            deleteCategory(type2, name)
            this.loadCategories()
          }
        }
      })
    }
  }
})
