"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { createStagePayment, type StagePayment } from "@/app/actions/stage-payments"
import type { Contractor } from "@/app/actions/contractors"

interface AddStagePaymentSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  projectId: string
  projectContractors: Contractor[]
  onAdded: (payment: StagePayment) => void
}

export function AddStagePaymentSheet({
  open,
  onOpenChange,
  projectId,
  projectContractors,
  onAdded,
}: AddStagePaymentSheetProps) {
  const { toast } = useToast()
  const [contractorId, setContractorId] = useState("")
  const [milestoneName, setMilestoneName] = useState("")
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [expectedDate, setExpectedDate] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!contractorId || !milestoneName || !amount) {
      toast({ title: "Contractor, milestone name, and amount are required", variant: "destructive" })
      return
    }
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const payment = await createStagePayment({
        projectId,
        contractorId,
        milestoneName,
        milestoneDescription: description || undefined,
        amount: amountNum,
        expectedDate: expectedDate || undefined,
        notes: notes || undefined,
      })
      onAdded(payment)
      toast({ title: "Milestone added" })
      onOpenChange(false)
      setContractorId("")
      setMilestoneName("")
      setDescription("")
      setAmount("")
      setExpectedDate("")
      setNotes("")
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[460px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add Payment Milestone</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 mt-6">
          <div>
            <Label className="mb-1.5 block">Contractor *</Label>
            <Select value={contractorId} onValueChange={setContractorId}>
              <SelectTrigger>
                <SelectValue placeholder="Select contractor" />
              </SelectTrigger>
              <SelectContent>
                {projectContractors.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company_name} — {c.contact_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5 block">Milestone Name *</Label>
            <Input
              placeholder="e.g. 30% on mobilisation"
              value={milestoneName}
              onChange={(e) => setMilestoneName(e.target.value)}
            />
          </div>

          <div>
            <Label className="mb-1.5 block">Description (optional)</Label>
            <Textarea
              placeholder="Describe what triggers this payment..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div>
            <Label className="mb-1.5 block">Amount (₹) *</Label>
            <Input
              type="number"
              min="1"
              placeholder="e.g. 150000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div>
            <Label className="mb-1.5 block">Expected Date (optional)</Label>
            <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
          </div>

          <div>
            <Label className="mb-1.5 block">Notes (optional)</Label>
            <Input
              placeholder="Any additional notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button
            className="w-full bg-[#1a1a2e] hover:bg-[#2d2d4e] text-white"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Adding…" : "Add Milestone"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
