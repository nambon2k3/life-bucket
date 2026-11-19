import { useEffect, useRef } from "react"

import { heatCellClass, heatLevel } from "@/lib/streak-heat"

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

type Cell = {
  iso: string
  label: string
  level: number
  future: boolean
  month: string
}

function isoOf(day: Date): string {
  const year = day.getFullYear()
  const month = String(day.getMonth() + 1).padStart(2, "0")
  const date = String(day.getDate()).padStart(2, "0")
  return `${year}-${month}-${date}`
}

function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00`)
}

function streakOn(days: Set<string>, iso: string): number {
  if (!days.has(iso)) return 0
  let count = 0
  const cursor = parseIso(iso)
  while (days.has(isoOf(cursor))) {
    count += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return count
}

function buildColumns(checkins: string[], weeks = 26): Cell[][] {
  const days = new Set(checkins)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setDate(today.getDate() - today.getDay() - (weeks - 1) * 7)

  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, weekday) => {
      const day = new Date(start)
      day.setDate(start.getDate() + week * 7 + weekday)
      const iso = isoOf(day)
      const future = day.getTime() > today.getTime()
      return {
        iso,
        label: day.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
        level: future ? 0 : heatLevel(streakOn(days, iso)),
        future,
        month: day.toLocaleDateString("en-GB", { month: "short" }),
      }
    }),
  )
}

export function HabitHeatmap({ checkins }: { checkins: string[] }) {
  const columns = buildColumns(checkins)
  const checked = checkins.length
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = scroller.current
    if (node) node.scrollLeft = node.scrollWidth
  }, [checkins])

  return (
    <div>
      <div className="flex gap-2">
        <div className="flex flex-col gap-[3px] pt-4 text-[9px] text-muted-foreground">
          {DAY_LABELS.map((label, index) => (
            <span key={label} className="flex h-[11px] items-center">
              {index % 2 === 1 ? label.slice(0, 1) : ""}
            </span>
          ))}
        </div>
        <div ref={scroller} className="overflow-x-auto">
          <div className="flex gap-[3px] text-[9px] text-muted-foreground">
            {columns.map((column) => {
              const firstOfMonth = column.find((cell) => cell.iso.endsWith("-01"))
              return (
                <span key={column[0]?.iso} className="w-[11px] shrink-0">
                  {firstOfMonth?.month ?? ""}
                </span>
              )
            })}
          </div>
          <div className="mt-1 flex gap-[3px]">
            {columns.map((column) => (
              <div key={column[0]?.iso} className="flex flex-col gap-[3px]">
                {column.map((cell) => (
                  <span
                    key={cell.iso}
                    title={cell.future ? "" : cell.level > 0 ? `${cell.label} · checked in` : `${cell.label} · no check-in`}
                    className={`size-[11px] rounded-[2px] ${cell.future ? "bg-transparent" : heatCellClass(cell.level)}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
        <span>{checked} day{checked === 1 ? "" : "s"}</span>
        <span className="ml-2">Less</span>
        {[0, 1, 2, 3, 4, 5].map((level) => (
          <span key={level} className={`size-[11px] rounded-[2px] ${heatCellClass(level)}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}
