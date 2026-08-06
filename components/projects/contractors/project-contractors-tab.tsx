"use client"

/**
 * Sprint 15 — Project Contractors Tab
 * Extracted from project-detail-client.tsx (the inline contractors tab content).
 * Rendered at /dashboard/projects/[id]/contractors
 */

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PermissionGate } from "@/components/PermissionGate"
import { useToast } from "@/hooks/use-toast"
import { assignContractorToProject } from "@/app/actions/contractors"
import { AddContractorSheet } from "@/components/contractors/add-contractor-sheet"
import { StagePaymentsSection } from "@/components/projects/contractors/stage-payments-section"
import type { Contractor } from "@/app/actions/contractors"
import type { StagePayment } from "@/app/actions/stage-payments"

interface ProjectContractorsTabProps {
  project: { id: string }
  projectContractors: Contractor[]
  studioContractors: Contractor[]
  initialStagePayments: StagePayment[]
  currentUser: { id: string; role: string }
}

export function ProjectContractorsTab({
  project,
  projectContractors,
  studioContractors,
  initialStagePayments,
  currentUser,
}: ProjectContractorsTabProps) {
  const { toast } = useToast()
  const [linked, setLinked] = useState<Contractor[]>(projectContractors)
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [showNewContractor, setShowNewContractor] = useState(false)
  const [selectedContractorId, setSelectedContractorId] = useState("")
  const [linking, setLinking] = useState(false)

  const unlinkedContractors = studioContractors.filter(
    (c) => !linked.some((l) => l.id === c.id)
  )

  async function handleLinkExisting() {
    if (!selectedContractorId) return
    setLinking(true)
    try {
      await assignContractorToProject(selectedContractorId, project.id)
      const contractor = studioContractors.find((c) => c.id === selectedContractorId)
      if (contractor) setLinked((prev) => [...prev, contractor])
      toast({ title: "Contractor added to project" })
      setSelectedContractorId("")
      setShowLinkDialog(false)
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setLinking(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Contractors</h3>
        <PermissionGate action="manage_contractors">
          <Button size="sm" variant="outline" onClick={() => setShowLinkDialog(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Contractor
          </Button>
        </PermissionGate>
      </div>

      {/* Assigned contractors list */}
      {linked.length === 0 ? (
        <p className="text-sm text-muted-foreground">No contractors assigned to this project yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {linked.map((c) => (
            <div key={c.id} className="bg-white border rounded-lg p-4">
              <p className="font-semibold">{c.company_name}</p>
              <p className="text-sm text-muted-foreground">{c.contact_name}</p>
              {c.phone && <p className="text-xs text-muted-foreground mt-1">{c.phone}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Stage Payments */}
      <StagePaymentsSection
        project={{ id: project.id }}
        initialPayments={initialStagePayments}
        projectContractors={linked}
        currentUser={{ id: currentUser.id, role: currentUser.role }}
      />

      {/* Link existing / create new contractor dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contractor to Project</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {unlinkedContractors.length > 0 ? (
              <div>
                <p className="text-sm font-medium mb-1.5">Select an existing contractor</p>
                <Select value={selectedContractorId} onValueChange={setSelectedContractorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select contractor" />
                  </SelectTrigger>
                  <SelectContent>
                    {unlinkedContractors.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.company_name} — {c.contact_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                All studio contractors are already assigned to this project.
              </p>
            )}

            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <Button
              variant="outline"
              onClick={() => {
                setShowLinkDialog(false)
                setShowNewContractor(true)
              }}
            >
              <Plus className="w-4 h-4 mr-1" /> Create New Contractor
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>Cancel</Button>
            <Button
              onClick={handleLinkExisting}
              disabled={!selectedContractorId || linking}
              className="bg-[#e94560] hover:bg-[#d63850] text-white"
            >
              {linking ? "Adding…" : "Add to Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create new studio contractor, linked to this project on save */}
      <AddContractorSheet
        open={showNewContractor}
        onOpenChange={setShowNewContractor}
        projectId={project.id}
        onCreated={(c) => setLinked((prev) => [...prev, c])}
      />
    </div>
  )
}
