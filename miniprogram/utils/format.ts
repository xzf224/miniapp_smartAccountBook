/**
 * 将十六进制颜色转为 rgba 字符串
 */
export function hexToRgba(color: string, alpha: number): string {
  const normalized = color.replace('#', '')
  const hex = normalized.length === 3
    ? normalized.split('').map(c => c + c).join('')
    : normalized

  if (hex.length !== 6) return `rgba(255, 138, 0, ${alpha})`

  const red = parseInt(hex.slice(0, 2), 16)
  const green = parseInt(hex.slice(2, 4), 16)
  const blue = parseInt(hex.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

/**
 * 生成分类图标背景色（主色 14% 透明度）
 */
export function createSoftBackground(color: string): string {
  return hexToRgba(color, 0.14)
}
