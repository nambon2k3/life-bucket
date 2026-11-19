export function heatLevel(days: number): number {
  if (days >= 30) return 5
  if (days >= 14) return 4
  if (days >= 7) return 3
  if (days >= 3) return 2
  if (days >= 1) return 1
  return 0
}

export function flameColors(days: number): { pale: string; mid: string; deep: string; duration: number } {
  const level = heatLevel(days)
  const palette = [
    { pale: "#a1a1aa", mid: "#71717a", deep: "#3f3f46", duration: 2.4 },
    { pale: "#fff7ed", mid: "#fde68a", deep: "#fcd34d", duration: 1.8 },
    { pale: "#ffedd5", mid: "#fdba74", deep: "#f59e0b", duration: 1.45 },
    { pale: "#fed7aa", mid: "#fb923c", deep: "#ea580c", duration: 1.15 },
    { pale: "#fdba74", mid: "#f97316", deep: "#c2410c", duration: 0.9 },
    { pale: "#fb923c", mid: "#ea580c", deep: "#7f1d1d", duration: 0.7 },
  ]
  return palette[level] ?? palette[0]
}

const CELL = ["bg-muted/80", "bg-amber-200", "bg-amber-400", "bg-orange-500", "bg-orange-700", "bg-red-900"]

export function heatCellClass(level: number): string {
  return CELL[level] ?? CELL[0]
}
