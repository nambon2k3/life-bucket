import { useId } from "react"

import { flameColors, heatLevel } from "@/lib/streak-heat"

export function StreakFlame({ days }: { days: number }) {
  const rawId = useId()
  const id = `flame-${rawId.replace(/:/g, "")}`
  const colors = flameColors(days)
  const moving = heatLevel(days) > 0

  return (
    <span className="inline-flex items-center gap-1.5" title={`${days}-day streak`}>
      <svg viewBox="0 0 24 24" className={moving ? "streak-flame size-5 shrink-0" : "size-5 shrink-0"} aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={colors.deep}>
              {moving ? (
                <animate
                  attributeName="offset"
                  values="0%;32%;0%"
                  dur={`${colors.duration}s`}
                  repeatCount="indefinite"
                />
              ) : null}
            </stop>
            <stop offset="58%" stopColor={colors.mid} />
            <stop offset="100%" stopColor={colors.pale}>
              {moving ? (
                <animate
                  attributeName="offset"
                  values="100%;68%;100%"
                  dur={`${colors.duration}s`}
                  repeatCount="indefinite"
                />
              ) : null}
            </stop>
          </linearGradient>
        </defs>
        <path
          fill={`url(#${id})`}
          d="M12.6 1.8c.5 2.8-.3 4.6-1.6 6.1 1-.4 1.8-1.2 2.2-2.4.8 1.8.6 3.6-.2 5.1 2-1.1 3.3-3.1 3.5-5.5 1 1.8 1.4 3.7 1.2 5.8 1 1.3 1.5 2.8 1.5 4.6 0 4.6-3.6 8.2-8.2 8.2S3 20.1 3 15.5c0-2.6 1.2-4.8 2.6-6.6 1.3 2 2.2 3 2.8 2.8.2-1.8-.3-3.7-.9-5.7 1.8 1.2 3 2.8 3.5 4.8C10.4 8.6 11.4 5.5 12.6 1.8z"
        />
      </svg>
      <span className="text-sm font-medium tabular-nums" style={{ color: colors.mid }}>
        {days}
      </span>
    </span>
  )
}
