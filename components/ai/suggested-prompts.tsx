"use client"

const PROJECT_PROMPTS = [
  "What tasks are overdue?",
  "Draft a client update message",
  "Any pending approvals?",
  "Summarise open RFIs",
]

const STUDIO_PROMPTS = [
  "Which projects need attention?",
  "Team leave this week?",
  "Overdue invoices?",
  "Outstanding payments?",
]

interface SuggestedPromptsProps {
  projectId: string | null
  onSelect: (prompt: string) => void
}

export function SuggestedPrompts({ projectId, onSelect }: SuggestedPromptsProps) {
  const prompts = projectId ? PROJECT_PROMPTS : STUDIO_PROMPTS

  return (
    <div className="flex flex-col items-center gap-4 py-6 px-2">
      <p className="text-xs text-text-muted">Ask me anything about this project</p>
      <div className="grid grid-cols-2 gap-2 w-full">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onSelect(prompt)}
            className="bg-surface border border-border-default rounded-[8px] px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:border-border-emphasis cursor-pointer transition-colors text-left"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  )
}
