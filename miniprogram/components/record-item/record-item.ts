import { CATEGORY_ICONS, CATEGORY_COLORS, fenToYuan } from '../../models/record'
import { getCategoryMeta, getCurrencySymbol } from '../../utils/storage'

function createSoftBackground(color: string): string {
  const normalized = color.replace('#', '')
  const hex = normalized.length === 3
    ? normalized.split('').map((item) => item + item).join('')
    : normalized

  if (hex.length !== 6) return 'rgba(255, 138, 0, 0.14)'

  const red = parseInt(hex.slice(0, 2), 16)
  const green = parseInt(hex.slice(2, 4), 16)
  const blue = parseInt(hex.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, 0.14)`
}

Component({
  properties: {
    record: { type: Object, value: {} },
    compact: { type: Boolean, value: false },
    iconVariant: { type: String, value: 'default' },
    subText: { type: String, value: '' },
  },

  observers: {
    'record, subText'(val: any, subText: string) {
      if (!val || !val.id) return
      const categoryMeta = getCategoryMeta()[val.category]
      const icon = categoryMeta?.icon || CATEGORY_ICONS[val.category] || '他'
      const iconColor = categoryMeta?.color || CATEGORY_COLORS[val.category] || '#95A5A6'
      const iconBg = categoryMeta?.bgColor || createSoftBackground(iconColor)
      const amountText = fenToYuan(val.amount)
      const currencySymbol = getCurrencySymbol(val.currency)
      const displaySubText = subText || val.note || ''
      let colorClass = 'text-neutral'
      let sign = ''
      if (val.type === '支出') { colorClass = 'text-expense'; sign = '-' }
      else if (val.type === '收入') { colorClass = 'text-income'; sign = '+' }
      this.setData({ icon, iconBg, iconColor, amountText, currencySymbol, displaySubText, colorClass, sign })
    },
  },

  data: {
    icon: '他',
    iconBg: 'rgba(149, 165, 166, 0.14)',
    iconColor: '#95A5A6',
    amountText: '0.00',
    currencySymbol: '¥',
    displaySubText: '',
    colorClass: 'text-neutral',
    sign: '',
  },

  methods: {},
})
