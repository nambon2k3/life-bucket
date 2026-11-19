import { Link } from "react-router-dom"

import { isSameDay } from "@/lib/format"
import type { Task } from "@/lib/types"

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function dayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function MonthCalendar({ tasks }: { tasks: Task[] }) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const byDay = new Map<string, Task[]>()
  for (const task of tasks) {
    if (!task.due_on) continue
    const due = new Date(`${task.due_on}T00:00:00`)
    if (due.getFullYear() !== year || due.getMonth() !== month) continue
    const key = task.due_on
    const list = byDay.get(key) ?? []
    list.push(task)
    byDay.set(key, list)
  }

  const title = today.toLocaleDateString("en-GB", { month: "long", year: "numeric" })

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">{title}</p>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border bg-border">
        {WEEKDAYS.map((label) => (
          <div key={label} className="bg-card px-2 py-2 text-center text-xs text-muted-foreground">
            {label}
          </div>
        ))}
        {cells.map((day, index) => {
          if (day === null) return <div key={`empty-${index}`} className="min-h-28 bg-background" />
          const key = dayKey(year, month, day)
          const items = byDay.get(key) ?? []
          const isToday = isSameDay(key, today)
          return (
            <div
              key={key}
              className={`min-h-28 bg-background p-2 transition-colors hover:bg-muted/70 ${isToday ? "ring-1 ring-inset ring-foreground/25" : ""}`}
            >
              <p className={`text-xs ${isToday ? "font-medium text-foreground" : "text-muted-foreground"}`}>{day}</p>
              <div className="mt-1 max-h-24 space-y-1 overflow-y-auto">
                {items.map((task) => (
                  <Link
                    key={task.id}
                    to={task.project_id ? `/projects/${task.project_id}` : "/inbox"}
                    title={`${task.title} · ${task.project_name ?? "General"}`}
                    className={`block truncate rounded px-1 py-0.5 text-[11px] transition-colors hover:bg-foreground/10 ${
                      task.status === "done" ? "text-muted-foreground line-through" : "text-foreground"
                    }`}
                  >
                    {task.title}
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
