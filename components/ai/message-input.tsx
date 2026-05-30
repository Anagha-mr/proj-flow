"use client"

import { useRef, useEffect, KeyboardEvent } from "react"
import { Send, Loader2 } from "lucide-react"

const MAX_CHARS = 500
const COUNTER_THRESHOLD = 450

interface MessageInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled: boolean
}

export function MessageInput({ value, onChange, onSubmit, disabled }: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    const lineHeight = 20
    const maxHeight = lineHeight * 5
    el.style.height = Math.min(el.scrollHeight, maxHeight) + "px"
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden"
  }, [value])

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (!disabled && value.trim()) onSubmit()
    }
  }

  const nearLimit = value.length >= COUNTER_THRESHOLD

  return (
    <div className="flex items-end gap-2 p-3 border-t border-border-default">
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            if (e.target.value.length <= MAX_CHARS) onChange(e.target.value)
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Ask about this project..."
          rows={1}
          className="w-full resize-none bg-surface border border-border-default rounded-[8px] px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent/50 focus:outline-none ring-0 disabled:opacity-50 leading-5"
          style={{ minHeight: "36px" }}
        />
        {nearLimit && (
          <span className="absolute bottom-2 right-2 text-[10px] text-text-muted pointer-events-none">
            {value.length}/{MAX_CHARS}
          </span>
        )}
      </div>

      <button
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        className="bg-accent text-white rounded-[6px] p-2 hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
      >
        {disabled ? (
          <Loader2 className="w-[14px] h-[14px] animate-spin" />
        ) : (
          <Send className="w-[14px] h-[14px]" />
        )}
      </button>
    </div>
  )
}
