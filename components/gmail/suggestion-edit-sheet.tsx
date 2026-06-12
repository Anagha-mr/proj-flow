"use client"

import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { editAndAcceptAISuggestion } from "@/app/actions/gmail"
import type { AISuggestion } from "@/app/actions/gmail"

interface SuggestionEditSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  suggestion: AISuggestion
  onAccepted: () => void
}

export function SuggestionEditSheet({
  open,
  onOpenChange,
  suggestion,
  onAccepted,
}: SuggestionEditSheetProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const data = suggestion.suggested_action_data

  // Per-type state
  const [approvalStatus, setApprovalStatus] = useState(
    (data.new_approval_status as string) ?? "approved"
  )
  const [taskTitle, setTaskTitle] = useState((data.title as string) ?? "")
  const [unitPrice, setUnitPrice] = useState(
    data.suggested_price !== undefined ? String(data.suggested_price) : ""
  )

  async function handleConfirm(overrides: Record<string, unknown>) {
    setLoading(true)
    try {
      await editAndAcceptAISuggestion(suggestion.id, overrides)
      toast({ title: "Action applied." })
      onAccepted()
      onOpenChange(false)
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const type = suggestion.suggested_action_type

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] max-w-full flex flex-col gap-0">
        <SheetHeader className="pb-4">
          <SheetTitle>Review AI Suggestion</SheetTitle>
        </SheetHeader>

        {/* Email context */}
        <div className="mb-5 p-3 rounded-[8px] bg-muted/40 text-sm flex flex-col gap-1">
          {suggestion.sender_name && (
            <p><span className="text-muted-foreground">From:</span> {suggestion.sender_name} ({suggestion.sender_email})</p>
          )}
          {suggestion.email_subject && (
            <p><span className="text-muted-foreground">Subject:</span> {suggestion.email_subject}</p>
          )}
        </div>

        {/* update_procurement_approval */}
        {type === "update_procurement_approval" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Item</Label>
              <p className="text-sm text-muted-foreground">{(data.item_name as string) ?? "—"}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Project</Label>
              <p className="text-sm text-muted-foreground">{(data.project_name as string) ?? "—"}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Approval Status</Label>
              <Select value={approvalStatus} onValueChange={setApprovalStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="revision_requested">Revision Requested</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => handleConfirm({ new_approval_status: approvalStatus })}
              disabled={loading}
              className="mt-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Confirm Action
            </Button>
          </div>
        )}

        {/* create_task */}
        {type === "create_task" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-title">Task Title</Label>
              <Input
                id="task-title"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
              />
            </div>
            {!!(data.project_id as string) && (
              <div className="flex flex-col gap-1.5">
                <Label>Project</Label>
                <p className="text-sm text-muted-foreground">{(data.project_name as string) ?? (data.project_id as string)}</p>
              </div>
            )}
            <Button
              onClick={() => handleConfirm({ title: taskTitle })}
              disabled={loading || !taskTitle.trim()}
              className="mt-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Create Task
            </Button>
          </div>
        )}

        {/* create_quote_response */}
        {type === "create_quote_response" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Vendor</Label>
              <p className="text-sm text-muted-foreground">{(data.vendor_name as string) ?? "—"}</p>
            </div>
            {!!(data.project_id as string) && (
              <div className="flex flex-col gap-1.5">
                <Label>Project</Label>
                <p className="text-sm text-muted-foreground">{(data.project_name as string) ?? (data.project_id as string)}</p>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unit-price">Unit Price (₹)</Label>
              <Input
                id="unit-price"
                type="number"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0"
              />
            </div>
            <Button
              onClick={() =>
                handleConfirm({
                  suggested_price: unitPrice ? Number(unitPrice) : undefined,
                })
              }
              disabled={loading}
              className="mt-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Log Quote
            </Button>
          </div>
        )}

        {/* update_invoice_status, log_site_update, no_action */}
        {(type === "update_invoice_status" ||
          type === "log_site_update" ||
          type === "no_action") && (
          <div className="flex flex-col gap-4">
            <div
              className="rounded-[8px] p-3 text-sm"
              style={{ background: "rgba(255,255,255,0.04)", color: "var(--color-text-secondary, inherit)" }}
            >
              {type === "update_invoice_status" && (
                <p>
                  Invoice {(data.invoice_number as string) ?? ""} from{" "}
                  {(data.client_name as string) ?? "client"}.
                  {data.amount ? ` Amount: ₹${Number(data.amount).toLocaleString("en-IN")}` : ""}
                  {" "}A reminder task will be created for you to review.
                </p>
              )}
              {type === "log_site_update" && (
                <p>AI detected a site-related update. Mark as reviewed to acknowledge.</p>
              )}
              {type === "no_action" && (
                <p>No specific action identified. Mark as reviewed to clear this suggestion.</p>
              )}
            </div>
            <Button
              onClick={() => handleConfirm({})}
              disabled={loading}
              className="mt-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Mark as Reviewed
            </Button>
          </div>
        )}

        <Button
          variant="ghost"
          onClick={() => onOpenChange(false)}
          className="mt-3"
        >
          Cancel
        </Button>
      </SheetContent>
    </Sheet>
  )
}
