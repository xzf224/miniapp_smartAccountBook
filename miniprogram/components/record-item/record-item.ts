import { CATEGORY_ICONS, CATEGORY_COLORS, fenToYuan } from '../../models/record'

Component({
  properties: {
    record: { type: Object, value: {} },
  },

  observers: {
    record(val: any) {
      if (!val || !val.id) return
      const icon = CATEGORY_ICONS[val.category] || '他'
      const iconBg = CATEGORY_COLORS[val.category] || '#95A5A6'
      const amountText = fenToYuan(val.amount)
      let colorClass = 'text-neutral'
      let sign = ''
      if (val.type === '支出') { colorClass = 'text-expense'; sign = '-' }
      else if (val.type === '收入') { colorClass = 'text-income'; sign = '+' }
      this.setData({ icon, iconBg, amountText, colorClass, sign })
    },
  },

  data: {
    icon: '他',
    iconBg: '#95A5A6',
    amountText: '0.00',
    colorClass: 'text-neutral',
    sign: '',
  },

  methods: {
    onTap() {
      this.triggerEvent('tap', { id: this.data.record.id })
    },
  },
})
