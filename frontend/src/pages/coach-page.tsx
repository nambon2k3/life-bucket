import { useState } from "react"
import { toast } from "sonner"

import { ErrorNote, SectionHeader } from "@/components/section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import type { ChatResponse } from "@/lib/types"

type Turn = {
  role: "user" | "assistant"
  content: string
  toolTrace?: string[]
}

const prompts = [
  "What should I focus on today?",
  "Which habits are still open?",
  "Check in Morning workout",
]

export function CoachPage() {
  const [draft, setDraft] = useState("")
  const [turns, setTurns] = useState<Turn[]>([])
  const [sending, setSending] = useState(false)

  async function send(text: string) {
    const content = text.trim()
    if (!content || sending) return
    const history = [...turns, { role: "user" as const, content }]
    setTurns(history)
    setDraft("")
    setSending(true)
    try {
      const response = await api<ChatResponse>("/api/v1/agent/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: history.map((turn) => ({ role: turn.role, content: turn.content })),
        }),
      })
      setTurns([...history, { role: "assistant", content: response.reply, toolTrace: response.tool_trace }])
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The coach is unavailable"
      toast.error(message)
      setTurns([...history, { role: "assistant", content: message }])
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <SectionHeader
        title="AI Coach"
        description="LangGraph calls a local Ollama model. Tool chips under a reply are the functions the graph actually ran."
      />
      <div className="mb-3 flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <Button key={prompt} variant="outline" size="sm" onClick={() => void send(prompt)}>
            {prompt}
          </Button>
        ))}
      </div>
      <div className="space-y-3 rounded-xl border bg-card p-4">
        {turns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ask about today, or tell the coach to check in a habit. The model needs to be running on this machine.
          </p>
        ) : null}
        {turns.map((turn, index) => (
          <div key={`${turn.role}-${index}`} className={turn.role === "user" ? "text-right" : "text-left"}>
            <div
              className={
                turn.role === "user"
                  ? "inline-block max-w-[80%] rounded-2xl bg-primary px-3 py-2 text-left text-sm text-primary-foreground"
                  : "inline-block max-w-[80%] rounded-2xl bg-muted px-3 py-2 text-sm"
              }
            >
              <p className="whitespace-pre-wrap">{turn.content}</p>
              {turn.toolTrace && turn.toolTrace.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {turn.toolTrace.map((name, toolIndex) => (
                    <Badge key={`${name}-${toolIndex}`} variant="outline">
                      {name}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {sending ? <p className="text-sm text-muted-foreground">Waiting for the local model…</p> : null}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void send(draft)
        }}
      >
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask the coach"
          rows={2}
        />
        <Button type="submit" disabled={sending || !draft.trim()}>
          Send
        </Button>
      </form>
      {turns.some((turn) => turn.role === "assistant" && turn.content.includes("unavailable")) ? (
        <div className="mt-3">
          <ErrorNote message="Start Ollama and pull a tool-calling model, for example qwen2.5:7b." />
        </div>
      ) : null}
    </div>
  )
}
