import { getCategories, addCategory, deleteCategory } from '../../utils/storage'
import { CATEGORY_ICONS, ICategories, DEFAULT_CATEGORIES } from '../../models/record'

interface CategoryDisplayItem {
  name: string
  icon: string
  isDefault: boolean
}

Component({
  data: {
    typeIndex: 0,
    types: ['支出', '收入'],
    categories: [] as CategoryDisplayItem[],
    newName: '',
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
      const list: string[] = typeIndex === 0 ? cats['支出'] : cats['收入']
      const defaults = typeIndex === 0 ? DEFAULT_CATEGORIES['支出'] : DEFAULT_CATEGORIES['收入']
      const categories: CategoryDisplayItem[] = list.map((name: string) => ({
        name,
        icon: CATEGORY_ICONS[name] || '他',
        isDefault: defaults.includes(name)
      }))
      this.setData({ categories })
    },

    onTypeChange(e: WechatMiniprogram.CustomEvent) {
      const typeIndex = Number(e.currentTarget.dataset.index)
      this.setData({ typeIndex, newName: '' }, () => this.loadCategories())
    },

    onNameInput(e: WechatMiniprogram.CustomEvent) {
      this.setData({ newName: e.detail.value })
    },

    onAddCategory() {
      const { newName, typeIndex } = this.data
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
      this.setData({ newName: '' })
      this.loadCategories()
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
