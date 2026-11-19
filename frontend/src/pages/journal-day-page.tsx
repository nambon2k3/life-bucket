import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { ErrorNote } from "@/components/section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import type { JournalEvent } from "@/lib/types"
import { useResource } from "@/lib/use-resource"

function isoOf(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function todayIso(): string {
  const now = new Date()
  return isoOf(now.getFullYear(), now.getMonth(), now.getDate())
}

function shiftDay(iso: string, delta: number): string {
  const date = new Date(`${iso}T00:00:00`)
  date.setDate(date.getDate() + delta)
  return isoOf(date.getFullYear(), date.getMonth(), date.getDate())
}

function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function clock(value: string | null): string {
  if (!value) return ""
  return value.slice(0, 5)
}

export function JournalDayPage() {
  const { day } = useParams()
  const navigate = useNavigate()
  const raw = day ?? ""
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(raw)
  const selected = valid ? raw : todayIso()
  const selectedDate = new Date(`${selected}T00:00:00`)
  const journal = useResource<JournalEvent[]>(
    `/api/v1/journal?year=${selectedDate.getFullYear()}&month=${selectedDate.getMonth() + 1}`,
  )
  const [atTime, setAtTime] = useState("")
  const [title, setTitle] = useState("")
  const [note, setNote] = useState("")
  const [tag, setTag] = useState("")
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [draftTime, setDraftTime] = useState("")
  const [draftTitle, setDraftTitle] = useState("")
  const [draftNote, setDraftNote] = useState("")
  const [draftTag, setDraftTag] = useState("")

  useEffect(() => {
    if (!valid) navigate("/journal", { replace: true })
  }, [navigate, valid])

  const events = useMemo(
    () => (journal.data ?? []).filter((event) => event.entry_on === selected),
    [journal.data, selected],
  )
  const today = todayIso()

  function openDay(iso: string) {
    setEditing(null)
    navigate(`/journal/${iso}`)
  }

  async function addEvent() {
    setSaving(true)
    try {
      await api("/api/v1/journal", {
        method: "POST",
        body: JSON.stringify({
          entry_on: selected,
          at_time: atTime || null,
          title,
          note,
          tag,
        }),
      })
      setTitle("")
      setNote("")
      setAtTime("")
      setTag("")
      await journal.reload()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not save the event")
    } finally {
      setSaving(false)
    }
  }

  function startEdit(event: JournalEvent) {
    setEditing(event.id)
    setDraftTime(clock(event.at_time))
    setDraftTitle(event.title)
    setDraftNote(event.note)
    setDraftTag(event.tag)
  }

  async function saveEdit(event: JournalEvent) {
    try {
      await api(`/api/v1/journal/${event.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          at_time: draftTime || null,
          title: draftTitle,
          note: draftNote,
          tag: draftTag,
        }),
      })
      setEditing(null)
      await journal.reload()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not update the event")
    }
  }

  async function remove(event: JournalEvent) {
    try {
      await api(`/api/v1/journal/${event.id}`, { method: "DELETE" })
      if (editing === event.id) setEditing(null)
      await journal.reload()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not remove the event")
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Back to journal" className="cursor-pointer" onClick={() => navigate("/journal")}>
            <ChevronLeft />
          </Button>
          <h2 className="text-base font-medium">{dayLabel(selected)}</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Previous day" className="cursor-pointer" onClick={() => openDay(shiftDay(selected, -1))}>
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Next day" className="cursor-pointer" onClick={() => openDay(shiftDay(selected, 1))}>
            <ChevronRight />
          </Button>
          {selected !== today ? (
            <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => openDay(today)}>
              Today
            </Button>
          ) : null}
        </div>
      </div>
      {journal.error ? <ErrorNote message={journal.error} /> : null}

      <form
        className="mt-4 grid gap-2 rounded-xl border bg-card p-3"
        onSubmit={(event) => {
          event.preventDefault()
          void addEvent()
        }}
      >
        <div className="grid gap-2 sm:grid-cols-[6.5rem_8rem_1fr]">
          <Input type="time" aria-label="Time" value={atTime} onChange={(event) => setAtTime(event.target.value)} />
          <Input aria-label="Tag" placeholder="Tag" value={tag} maxLength={40} onChange={(event) => setTag(event.target.value)} />
          <Input
            aria-label="What happened"
            placeholder="What happened"
            value={title}
            maxLength={140}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <Textarea
          aria-label="Note"
          placeholder="A short paragraph, optional"
          value={note}
          maxLength={280}
          onChange={(event) => setNote(event.target.value)}
        />
        <div>
          <Button type="submit" size="sm" className="cursor-pointer" disabled={saving || !title.trim()}>
            Add event
          </Button>
        </div>
      </form>

      {events.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Nothing recorded for this day yet.</p>
      ) : (
        <ol className="mt-6">
          {events.map((event, index) => (
            <li key={event.id} className="flex gap-3">
              <p className="w-12 shrink-0 pt-3 text-right text-xs tabular-nums text-muted-foreground">{clock(event.at_time) || "—"}</p>
              <div className={`relative min-w-0 flex-1 pl-5 ${index === events.length - 1 ? "pb-0" : "pb-4"}`}>
                <span className="absolute top-4 left-0 size-2 -translate-x-1/2 rounded-full bg-foreground ring-4 ring-background" />
                {index === events.length - 1 ? null : (
                  <span className="absolute top-6 bottom-0 left-0 w-px -translate-x-1/2 bg-border" />
                )}
                <article className="rounded-xl border bg-card px-3 py-2.5 transition-colors hover:bg-muted/40">
                  {editing === event.id ? (
                    <div className="grid gap-2">
                      <Input type="time" aria-label="Edit time" value={draftTime} onChange={(input) => setDraftTime(input.target.value)} />
                      <Input aria-label="Edit tag" placeholder="Tag" value={draftTag} maxLength={40} onChange={(input) => setDraftTag(input.target.value)} />
                      <Input aria-label="Edit event" value={draftTitle} maxLength={140} onChange={(input) => setDraftTitle(input.target.value)} />
                      <Textarea aria-label="Edit note" value={draftNote} maxLength={280} onChange={(input) => setDraftNote(input.target.value)} />
                      <div className="flex gap-2">
                        <Button size="sm" className="cursor-pointer" disabled={!draftTitle.trim()} onClick={() => void saveEdit(event)}>
                          Save
                        </Button>
                        <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setEditing(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{event.title}</p>
                        {event.note ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{event.note}</p> : null}
                        {event.tag ? <p className="mt-2 text-xs text-muted-foreground">{event.tag}</p> : null}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${event.title}`} className="cursor-pointer" onClick={() => startEdit(event)}>
                          <Pencil />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${event.title}`} className="cursor-pointer" onClick={() => void remove(event)}>
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  )}
                </article>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
