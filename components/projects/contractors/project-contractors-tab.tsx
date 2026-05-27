"use client"

/**
 * Sprint 15 — Project Contractors Tab
 * Extracted from project-detail-client.tsx (the inline contractors tab content).
 * Rendered at /dashboard/projects/[id]/contractors
 */

import { StagePaymentsSection } from "@/components/projects/contractors/stage-payments-section"
import type { Contractor } from "@/app/actions/contractors"
import type { StagePayment } from "@/app/actions/stage-payments"

interface ProjectContractorsTabProps {
  project: { id: string }
  projectContractors: Contractor[]
  initialStagePayments: StagePayment[]
  currentUser: { id: string; role: string }
}

export function ProjectContractorsTab({
  project,
  projectContractors,
  initialStagePayments,
  currentUser,
}: ProjectContractorsTabProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Assigned contractors list */}
      {projectContractors.length === 0 ? (
        <p className="text-sm text-muted-foreground">No contractors assigned to this project yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projectContractors.map((c) => (
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
        projectContractors={projectContractors}
        currentUser={{ id: currentUser.id, role: currentUser.role }}
      />
    </div>
  )
}
