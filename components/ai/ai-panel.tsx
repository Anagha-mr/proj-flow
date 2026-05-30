"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Sparkles, X, Trash2 } from "lucide-react"
import {
  getOrCreateConversation,
  getConversationHistory,
  clearConversation,
} from "@/app/actions/ai"
import type { AIMessage } from "@/app/actions/ai"
import { MessageBubble, StreamingBubble } from "./message-bubble"
import { SuggestedPrompts } from "./suggested-prompts"
import { MessageInput } from "./message-input"

// ─── Trigger Button ───────────────────────────────────────────────────────────

interface AITriggerButtonProps {
  isOpen: boolean
  onClick: () => void
}

export function AITriggerButton({ isOpen, onClick }: AITriggerButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-40 bg-accent text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:bg-accent/90 hover:scale-105 transition-all sm:bottom-6 sm:right-6 bottom-4 right-4"
      aria-label={isOpen ? "Close AI Assistant" : "Open AI Assistant"}
    >
      {isOpen ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
    </button>
  )
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function MessageSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
          <div className="bg-surface/60 rounded-[10px] animate-pulse" style={{ width: `${50 + i * 10}%`, height: "40px" }} />
        </div>
      ))}
    </div>
  )
}

// ─── AI Panel ─────────────────────────────────────────────────────────────────

interface AIPanelProps {
  isOpen: boolean
  onClose: () => void
  projectId: string | null
  projectName: string | null
}

export function AIPanel({ isOpen, onClose, projectId, projectName }: AIPanelProps) {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState("")
  const [inputValue, setInputValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevProjectId = useRef<string | null | undefined>(undefined)

  // Load conversation when panel opens or project changes
  useEffect(() => {
    if (!isOpen) return
    if (prevProjectId.current === projectId) return
    prevProjectId.current = projectId

    setLoading(true)
    setMessages([])
    setConversationId(null)

    getOrCreateConversation(projectId)
      .then((convId) => {
        setConversationId(convId)
        return getConversationHistory(convId)
      })
      .then((history) => {
        setMessages(history)
      })
      .catch(() => {
        setError("Failed to load conversation.")
      })
      .finally(() => setLoading(false))
  }, [isOpen, projectId])

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamingText])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!conversationId || !text.trim() || streaming) return

      setInputValue("")
      setStreaming(true)
      setStreamingText("")
      setError(null)

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId,
            projectId,
            userMessage: text.trim(),
          }),
        })

        if (res.status === 429) {
          setError("You're sending messages too quickly — wait a moment and try again.")
          setStreaming(false)
          return
        }
        if (!res.ok) {
          setError("Sorry, I couldn't process that request. Please try again.")
          setStreaming(false)
          return
        }

        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let assembled = ""
        let pendingAction: AIMessage["action_proposal"] | undefined

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split("\n")

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            const dataStr = line.slice(6).trim()
            if (!dataStr) continue

            let event: { type: string; delta?: string; payload?: AIMessage["action_proposal"]; message?: string }
            try {
              event = JSON.parse(dataStr)
            } catch {
              continue
            }

            if (event.type === "text_delta" && event.delta) {
              assembled += event.delta
              setStreamingText(assembled)
            } else if (event.type === "action" && event.payload) {
              pendingAction = event.payload
            } else if (event.type === "error") {
              setError("Sorry, I couldn't process that request. Please try again.")
            } else if (event.type === "done") {
              // Reload history from DB (has both user + assistant messages)
              const updated = await getConversationHistory(conversationId)
              setMessages(updated)
              setStreamingText("")
              pendingAction = undefined
            }
          }
        }
      } catch {
        setError("Sorry, I couldn't process that request. Please try again.")
      } finally {
        setStreaming(false)
        setStreamingText("")
      }
    },
    [conversationId, projectId, streaming]
  )

  async function handleClear() {
    if (!conversationId) return
    try {
      await clearConversation(conversationId)
      setMessages([])
      setError(null)
    } catch {
      // ignore
    }
  }

  function handleActionUpdate() {
    if (!conversationId) return
    getConversationHistory(conversationId).then(setMessages).catch(() => null)
  }

  // Keyboard shortcut Cmd/Ctrl+I handled in layout

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 h-screen z-50 flex flex-col bg-card border-l border-border-default transition-transform duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)] w-[400px] sm:w-[400px] w-full`}
        style={{ transform: isOpen ? "translateX(0)" : "translateX(100%)" }}
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <div className="bg-shell border-b border-border-default px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-[14px] h-[14px] text-accent" />
              <span className="text-sm font-semibold text-text-primary">AI Assistant</span>
            </div>
            <span className="text-xs text-text-muted">
              {projectName ? projectName : "Studio view"}
              {loading ? " · Loading..." : " · Context loaded"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1 transition-colors"
                title="Clear conversation"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            )}
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary transition-colors"
              aria-label="Close AI panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {loading ? (
            <MessageSkeleton />
          ) : messages.length === 0 && !streaming ? (
            <SuggestedPrompts
              projectId={projectId}
              onSelect={(prompt) => {
                setInputValue(prompt)
                sendMessage(prompt)
              }}
            />
          ) : (
            <>
              {messages.map((msg, i) => (
                <MessageBubble
                  key={`${msg.timestamp}-${i}`}
                  message={msg}
                  conversationId={conversationId ?? ""}
                  onActionConfirmed={handleActionUpdate}
                  onActionDismissed={handleActionUpdate}
                />
              ))}
              {streaming && streamingText && (
                <StreamingBubble content={streamingText} />
              )}
            </>
          )}

          {error && (
            <div className="flex justify-start">
              <div className="bg-surface border border-border-default rounded-[12px] rounded-tl-[2px] px-3 py-2 max-w-[90%]">
                <p className="text-sm text-text-muted">{error}</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <MessageInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={() => sendMessage(inputValue)}
          disabled={streaming || loading || !conversationId}
        />
      </div>
    </>
  )
}
