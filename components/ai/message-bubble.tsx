"use client"

import { format } from "date-fns"
import { ActionProposalCard } from "./action-proposal-card"
import type { AIMessage } from "@/app/actions/ai"

interface MessageBubbleProps {
  message: AIMessage
  conversationId: string
  onActionConfirmed: (timestamp: string) => void
  onActionDismissed: (timestamp: string) => void
}

export function MessageBubble({
  message,
  conversationId,
  onActionConfirmed,
  onActionDismissed,
}: MessageBubbleProps) {
  const isUser = message.role === "user"

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"} max-w-[90%]`}>
        <div
          className={
            isUser
              ? "bg-accent/10 border border-accent/20 rounded-[12px] rounded-tr-[2px] px-3 py-2 max-w-[80%]"
              : "bg-surface border border-border-default rounded-[12px] rounded-tl-[2px] px-3 py-2"
          }
        >
          <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </p>

          {message.action_proposal && (
            <ActionProposalCard
              proposal={message.action_proposal}
              conversationId={conversationId}
              messageTimestamp={message.timestamp}
              onConfirmed={() => onActionConfirmed(message.timestamp)}
              onDismissed={() => onActionDismissed(message.timestamp)}
            />
          )}
        </div>

        <span className="text-[10px] text-text-muted px-1">
          {format(new Date(message.timestamp), "h:mm a")}
        </span>
      </div>
    </div>
  )
}

interface StreamingBubbleProps {
  content: string
}

export function StreamingBubble({ content }: StreamingBubbleProps) {
  return (
    <div className="flex justify-start">
      <div className="flex flex-col gap-1 items-start">
        <div className="bg-surface border border-border-default rounded-[12px] rounded-tl-[2px] px-3 py-2">
          <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap break-words">
            {content}
            <span className="animate-pulse">|</span>
          </p>
        </div>
      </div>
    </div>
  )
}
