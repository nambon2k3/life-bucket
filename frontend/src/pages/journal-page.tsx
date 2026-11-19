import { useMemo, useState } from "react"
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Plus, Search, Tag } from "lucide-react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { ErrorNote } from "@/components/section"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import type { JournalEvent } from "@/lib/types"
import { useResource } from "@/lib/use-resource"

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"]

function isoOf(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function todayIso(): string {
  const now = new Date()
  return isoOf(now.getFullYear(), now.getMonth(), now.getDate())
}

function entryDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function EntryCard({ event }: { event: JournalEvent }) {
  return (
    <Link
      to={`/journal/${event.entry_on}`}
      className="mb-3 block cursor-pointer break-inside-avoid rounded-xl border bg-card px-4 py-3.5 transition-colors hover:bg-muted/50"
    >
      <p className="font-medium leading-snug">{event.title}</p>
      {event.note ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{event.note}</p> : null}
      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="text-xs text-muted-foreground">{entryDate(event.entry_on)}</p>
        {event.tag ? (
          <span className="rounded-md border px-1.5 py-0.5 text-xs text-foreground/80">{event.tag}</span>
        ) : null}
      </div>
    </Link>
  )
}

function CardGrid({ events }: { events: JournalEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
  }
  return (
    <div className="columns-1 gap-3 sm:columns-2 xl:columns-3">
      {events.map((event) => (
        <EntryCard key={event.id} event={event} />
      ))}
    </div>
  )
}

export function JournalPage() {
  const journal = useResource<JournalEvent[]>("/api/v1/journal")
  const [view, setView] = useState("recent")
  const [tag, setTag] = useState("all")
  const [query, setQuery] = useState("")
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [open, setOpen] = useState(false)
  const [entryOn, setEntryOn] = useState(todayIso)
  const [atTime, setAtTime] = useState("")
  const [title, setTitle] = useState("")
  const [note, setNote] = useState("")
  const [draftTag, setDraftTag] = useState("")
  const [saving, setSaving] = useState(false)

  const tags = useMemo(() => {
    const names = new Set<string>()
    for (const event of journal.data ?? []) {
      if (event.tag) names.add(event.tag)
    }
    return [...names].sort((left, right) => left.localeCompare(right))
  }, [journal.data])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (journal.data ?? []).filter((event) => {
      if (tag !== "all" && event.tag !== tag) return false
      if (!needle) return true
      return `${event.title} ${event.note} ${event.tag}`.toLowerCase().includes(needle)
    })
  }, [journal.data, query, tag])

  const monthEvents = useMemo(() => {
    const prefix = isoOf(cursor.year, cursor.month, 1).slice(0, 7)
    return visible.filter((event) => event.entry_on.startsWith(prefix))
  }, [cursor, visible])

  const groups = useMemo(() => {
    const buckets = new Map<string, JournalEvent[]>()
    for (const event of visible) {
      const key = event.tag || "Untagged"
      const list = buckets.get(key) ?? []
      list.push(event)
      buckets.set(key, list)
    }
    return [...buckets.entries()].sort(([left], [right]) => {
      if (left === "Untagged") return 1
      if (right === "Untagged") return -1
      return left.localeCompare(right)
    })
  }, [visible])

  const marked = useMemo(() => new Set(monthEvents.map((event) => event.entry_on)), [monthEvents])
  const firstWeekday = (new Date(cursor.year, cursor.month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate()
  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]
  const monthName = new Date(cursor.year, cursor.month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })
  const today = todayIso()

  function shiftMonth(delta: number) {
    const next = new Date(cursor.year, cursor.month + delta, 1)
    setCursor({ year: next.getFullYear(), month: next.getMonth() })
  }

  async function createEvent() {
    setSaving(true)
    try {
      await api("/api/v1/journal", {
        method: "POST",
        body: JSON.stringify({
          entry_on: entryOn,
          at_time: atTime || null,
          title,
          note,
          tag: draftTag,
        }),
      })
      setTitle("")
      setNote("")
      setAtTime("")
      setDraftTag("")
      setOpen(false)
      await journal.reload()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not save the event")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Tabs value={view} onValueChange={setView}>
          <TabsList variant="line">
            <TabsTrigger value="recent" className="cursor-pointer">
              <Clock />
              Recent
            </TabsTrigger>
            <TabsTrigger value="calendar" className="cursor-pointer">
              <CalendarDays />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="tag" className="cursor-pointer">
              <Tag />
              By Tag
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={tag} onValueChange={setTag}>
          <SelectTrigger aria-label="Tag" className="h-8 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {tags.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search journal"
              placeholder="Search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-8 w-36 pl-8"
            />
          </div>
          <Button size="icon-sm" aria-label="New entry" className="cursor-pointer" onClick={() => setOpen(true)}>
            <Plus />
          </Button>
        </div>
      </div>

      {journal.error ? <ErrorNote message={journal.error} /> : null}
      {journal.loading && !journal.data ? <p className="text-sm text-muted-foreground">Loading journal…</p> : null}

      {view === "calendar" ? (
        <section className="mb-6 rounded-xl border bg-card p-3 sm:max-w-md">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Button variant="ghost" size="icon-sm" aria-label="Previous month" className="cursor-pointer" onClick={() => shiftMonth(-1)}>
              <ChevronLeft />
            </Button>
            <p className="text-sm font-medium">{monthName}</p>
            <Button variant="ghost" size="icon-sm" aria-label="Next month" className="cursor-pointer" onClick={() => shiftMonth(1)}>
              <ChevronRight />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
            {WEEKDAYS.map((label, index) => (
              <span key={`${label}-${index}`}>{label}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((day, index) => {
              if (day === null) return <span key={`empty-${index}`} />
              const iso = isoOf(cursor.year, cursor.month, day)
              const hasEvents = marked.has(iso)
              return (
                <Link
                  key={iso}
                  to={`/journal/${iso}`}
                  className={`relative flex h-8 cursor-pointer items-center justify-center rounded-md text-xs transition-colors hover:bg-muted ${
                    iso === today ? "ring-1 ring-foreground/30" : ""
                  }`}
                >
                  {day}
                  {hasEvents ? <span className="absolute bottom-1 size-1 rounded-full bg-foreground/70" /> : null}
                </Link>
              )
            })}
          </div>
        </section>
      ) : null}

      {view === "tag" ? (
        groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-8">
            {groups.map(([name, events]) => (
              <section key={name}>
                <h3 className="mb-3 text-sm font-medium">{name}</h3>
                <CardGrid events={events} />
              </section>
            ))}
          </div>
        )
      ) : (
        <CardGrid events={view === "calendar" ? monthEvents : visible} />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New entry</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="entry-date">Date</Label>
                <Input id="entry-date" type="date" value={entryOn} onChange={(event) => setEntryOn(event.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="entry-time">Time</Label>
                <Input id="entry-time" type="time" value={atTime} onChange={(event) => setAtTime(event.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="entry-title">What happened</Label>
              <Input id="entry-title" value={title} maxLength={140} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="entry-note">Note</Label>
              <Textarea
                id="entry-note"
                value={note}
                maxLength={280}
                placeholder="A short paragraph, optional"
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="entry-tag">Tag</Label>
              <Input
                id="entry-tag"
                value={draftTag}
                maxLength={40}
                placeholder="Learning, Personal, …"
                list="journal-tags"
                onChange={(event) => setDraftTag(event.target.value)}
              />
              <datalist id="journal-tags">
                {tags.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
          </div>
          <DialogFooter>
            <Button className="cursor-pointer" disabled={saving || !title.trim() || !entryOn} onClick={() => void createEvent()}>
              Save entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
