export function formatDate(value: string | null): string {
  if (!value) return "No date"
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`)
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

export function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
}

export function secondsAgo(value: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000))
}

function atMidnight(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

export function isSameDay(value: string | null, day: Date): boolean {
  if (!value) return false
  return atMidnight(value).toDateString() === day.toDateString()
}

export function isOverdue(value: string | null, status: string): boolean {
  if (!value || status === "done") return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return atMidnight(value) < today
}

export function isThisMonth(value: string | null, day = new Date()): boolean {
  if (!value) return false
  const date = atMidnight(value)
  return date.getFullYear() === day.getFullYear() && date.getMonth() === day.getMonth()
}

export function isThisWeek(value: string | null): boolean {
  if (!value) return false
  const date = atMidnight(value)
  const start = new Date()
  const weekday = start.getDay()
  const mondayOffset = weekday === 0 ? 6 : weekday - 1
  start.setDate(start.getDate() - mondayOffset)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 7)
  return date >= start && date < end
}

export function statusLabel(status: string): string {
  if (status === "in_progress") return "In progress"
  if (status === "completed") return "Completed"
  if (status === "planned") return "Planned"
  return status
}
