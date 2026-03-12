import { CATEGORY_ICONS, CATEGORY_COLORS } from '../../models/record'

type CategoryItem = { name: string; icon: string; color: string }

Component({
  properties: {
    categories: { type: Array, value: [] as string[] },
    selected: { type: String, value: '' },
  },

  data: {
    categoryItems: [] as CategoryItem[],
  },

  observers: {
    categories(val: string[]) {
      this._mapCategories(val)
    },
  },

  lifetimes: {
    ready() {
      // Fallback: ensure categories are mapped even if observer missed the initial value
      const cats = (this.data as any).categories as string[]
      if (cats && cats.length > 0 && (this.data.categoryItems as CategoryItem[]).length === 0) {
        this._mapCategories(cats)
      }
    },
  },

  pageLifetimes: {
    show() {
      const cats = (this.data as any).categories as string[]
      if (cats && cats.length > 0 && (this.data.categoryItems as CategoryItem[]).length === 0) {
        this._mapCategories(cats)
      }
    },
  },

  methods: {
    _mapCategories(val: string[]) {
      const categoryItems: CategoryItem[] = (val || []).map(name => ({
        name,
        icon: CATEGORY_ICONS[name] || name[0] || '他',
        color: CATEGORY_COLORS[name] || '#95A5A6',
      }))
      this.setData({ categoryItems })
    },

    onSelect(e: WechatMiniprogram.TouchEvent) {
      const name = (e.currentTarget.dataset as any).name as string
      this.triggerEvent('select', { category: name })
    },
  },
})
