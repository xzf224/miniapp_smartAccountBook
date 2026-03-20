import { addCategory, getCategories, deleteCategory, getCategoryMeta, setCategoryMeta, upsertBudget } from '../../utils/storage'
import { CATEGORY_COLORS, CATEGORY_ICONS, DEFAULT_CATEGORIES, ICategories, IBudget, yuanToFen } from '../../models/record'

interface CategoryDisplayItem {
  name: string
  displayName: string
  icon: string
  isDefault: boolean
  color: string
  bgColor: string
}

interface FormPreviewPatch {
  typeIndex?: number
  newName?: string
  budgetYuan?: string
  selectedColor?: string
}

const PASTEL_BACKGROUNDS = [
  '#FFF2E8', '#EEF4FF', '#F4EDFF', '#EAFBF1',
  '#EDF5FF', '#FFF0F4', '#FFF8E5', '#EEFBEF',
]

const DISPLAY_NAME_MAP: Record<string, string> = {
  '生活缴费': '水电',
  '其他人情': '人情',
  '发红包': '红包',
}

const FORM_ICON_OPTIONS = [
  '⌂', '车', '礼', '音', '相',
  '剪', '宠', '医', '花', '伞',
  '镜', '耳', '旅', '心', '冠',
  '钥', '锚', '羽', '星', '游',
]

const FORM_COLOR_OPTIONS = [
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

Component({
  data: {
    typeIndex: 0,
    types: ['支出', '收入'],
    categories: [] as CategoryDisplayItem[],
    showAddForm: false,
    selectedIcon: FORM_ICON_OPTIONS[0],
    selectedColor: FORM_COLOR_OPTIONS[1],
    selectedPreviewBg: createSoftBackground(FORM_COLOR_OPTIONS[1]),
    newName: '',
    budgetYuan: '',
    formNamePreviewText: '未命名分类',
    formBudgetPreviewText: '未设置预算',
    formTypePreviewText: '支出',
    iconOptions: FORM_ICON_OPTIONS,
    colorOptions: FORM_COLOR_OPTIONS,
  },

  lifetimes: {
    attached() {
      this.loadCategories()
    }
  },

  pageLifetimes: {
    show() {
      this.loadCategories()
    },
  },

  methods: {
    buildFormPreview(patch: FormPreviewPatch) {
      const typeIndex = typeof patch.typeIndex === 'number' ? patch.typeIndex : this.data.typeIndex
      const newName = typeof patch.newName === 'string' ? patch.newName : this.data.newName
      const budgetYuan = typeof patch.budgetYuan === 'string' ? patch.budgetYuan : this.data.budgetYuan
      const selectedColor = typeof patch.selectedColor === 'string' ? patch.selectedColor : this.data.selectedColor

      return {
        selectedPreviewBg: createSoftBackground(selectedColor),
        formNamePreviewText: newName.trim() || '未命名分类',
        formBudgetPreviewText: budgetYuan ? `¥${budgetYuan}` : '未设置预算',
        formTypePreviewText: this.data.types[typeIndex] || '支出',
      }
    },

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
          displayName: DISPLAY_NAME_MAP[name] || name,
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
      this.setData({
        typeIndex,
        ...this.buildFormPreview({ typeIndex }),
      }, () => this.loadCategories())
    },

    onAddCategory() {
      this.setData({
        showAddForm: true,
        selectedIcon: FORM_ICON_OPTIONS[0],
        selectedColor: FORM_COLOR_OPTIONS[1],
        selectedPreviewBg: createSoftBackground(FORM_COLOR_OPTIONS[1]),
        newName: '',
        budgetYuan: '',
        formNamePreviewText: '未命名分类',
        formBudgetPreviewText: '未设置预算',
        formTypePreviewText: this.data.types[this.data.typeIndex] || '支出',
      })
    },

    onCloseAddForm() {
      this.setData({ showAddForm: false })
    },

    onSelectIcon(e: WechatMiniprogram.TouchEvent) {
      const selectedIcon = (e.currentTarget.dataset || {}).icon as string
      this.setData({ selectedIcon })
    },

    onSelectColor(e: WechatMiniprogram.TouchEvent) {
      const selectedColor = (e.currentTarget.dataset || {}).color as string
      this.setData({
        selectedColor,
        ...this.buildFormPreview({ selectedColor }),
      })
    },

    onNameInput(e: WechatMiniprogram.Input) {
      const newName = e.detail.value
      this.setData({
        newName,
        ...this.buildFormPreview({ newName }),
      })
    },

    onBudgetInput(e: WechatMiniprogram.Input) {
      const raw = e.detail.value.replace(/[^\d.]/g, '')
      const normalized = raw
        .replace(/^\./, '')
        .replace(/(\..*)\./g, '$1')
        .replace(/^(\d+)\.(\d{0,2}).*$/, '$1.$2')
      this.setData({
        budgetYuan: normalized,
        ...this.buildFormPreview({ budgetYuan: normalized }),
      })
    },

    onSaveCategory() {
      const { newName, typeIndex, selectedIcon, selectedColor, budgetYuan } = this.data
      const trimmed = newName.trim()
      if (!trimmed) {
        wx.showToast({ title: '请输入分类名称', icon: 'none' })
        return
      }

      const type: keyof ICategories = typeIndex === 0 ? '支出' : '收入'
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

      this.setData({
        showAddForm: false,
        selectedIcon: FORM_ICON_OPTIONS[0],
        selectedColor: FORM_COLOR_OPTIONS[1],
        selectedPreviewBg: createSoftBackground(FORM_COLOR_OPTIONS[1]),
        newName: '',
        budgetYuan: '',
        formNamePreviewText: '未命名分类',
        formBudgetPreviewText: '未设置预算',
        formTypePreviewText: this.data.types[this.data.typeIndex] || '支出',
      })
      this.loadCategories()
      wx.showToast({ title: '分类已添加', icon: 'success' })
    },

    onCategoryLongPress(e: WechatMiniprogram.CustomEvent) {
      const name = e.currentTarget.dataset.name as string
      const { typeIndex } = this.data
      const cats = this.data.categories
      const item = cats.find(c => c.name === name)
      if (item && item.isDefault) {
        wx.showToast({ title: '系统分类不可删除', icon: 'none' })
        return
      }
      wx.showActionSheet({
        itemList: ['删除分类'],
        itemColor: '#ff4d4f',
        success: (res) => {
          if (res.tapIndex !== 0) return
          wx.showModal({
            title: '确认删除',
            content: `删除分类“${name}”？该分类下的记录不受影响。`,
            confirmText: '删除',
            confirmColor: '#ff4d4f',
            success: (modalRes) => {
              if (!modalRes.confirm) return
              const cats2 = getCategories()
              const type2: keyof typeof cats2 = typeIndex === 0 ? '支出' : '收入'
              deleteCategory(type2, name)
              this.loadCategories()
            }
          })
        }
      })
    },
  }
})
