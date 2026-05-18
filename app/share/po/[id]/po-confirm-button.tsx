"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CheckCircle2 } from "lucide-react"

interface POConfirmButtonProps {
  poId: string
  isConfirmed: boolean
}

export function POConfirmButton({ poId, isConfirmed: initialConfirmed }: POConfirmButtonProps) {
  const [confirmed, setConfirmed] = useState(initialConfirmed)
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    try {
      const res = await fetch(`/api/po/${poId}/confirm`, { method: 'PATCH' })
      if (res.ok) {
        setConfirmed(true)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  if (confirmed) {
    return (
      <div className="flex items-center gap-2 text-green-700 font-medium">
        <CheckCircle2 className="w-5 h-5" />
        Receipt Confirmed ✓
      </div>
    )
  }

  return (
    <Button
      onClick={handleConfirm}
      disabled={loading}
      className="bg-[#e94560] hover:bg-[#c73652]"
    >
      {loading ? 'Confirming…' : 'Confirm Receipt'}
    </Button>
  )
}
