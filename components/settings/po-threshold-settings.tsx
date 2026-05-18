"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { updateStudioSettings } from "@/app/actions/settings"
import { useToast } from "@/hooks/use-toast"

interface POThresholdSettingsProps {
  initialThreshold: number
}

export function POThresholdSettings({ initialThreshold }: POThresholdSettingsProps) {
  const { toast } = useToast()
  const [threshold, setThreshold] = useState(String(initialThreshold))
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await updateStudioSettings({ po_approval_threshold: Number(threshold) || 0 })
      toast({ title: "PO approval threshold saved" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-3 max-w-sm">
          <div className="flex flex-col gap-1.5">
            <Label>PO Approval Threshold (₹)</Label>
            <Input
              type="number"
              min={0}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Purchase orders below this amount are auto-approved. Set to ₹0 to require approval for all POs.
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-fit bg-[#e94560] hover:bg-[#c73652]">
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
