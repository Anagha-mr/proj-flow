"use client"

import { useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { SchedulesTab } from "./schedules-tab"
import { ApprovalsTab } from "./approvals-tab"
import { FinancialTab } from "./financial-tab"

interface ProcurementTabProps {
  projectId: string
  studioId: string
  userRole: string
  currentUserId: string
}

export function ProcurementTab({ projectId, studioId, userRole, currentUserId }: ProcurementTabProps) {
  const [activeSubTab, setActiveSubTab] = useState("schedules")

  return (
    <div className="flex flex-col gap-0">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="flex w-full justify-start h-auto bg-transparent border-b rounded-none p-0 gap-0 mb-6">
          {[
            { value: "schedules", label: "Schedules" },
            { value: "approvals", label: "Approvals" },
            { value: "financial", label: "Financial" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#e94560] data-[state=active]:bg-transparent data-[state=active]:text-[#e94560] px-4 pb-2 text-sm shrink-0"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="schedules">
          <SchedulesTab
            projectId={projectId}
            studioId={studioId}
            userRole={userRole}
            currentUserId={currentUserId}
          />
        </TabsContent>

        <TabsContent value="approvals">
          <ApprovalsTab
            projectId={projectId}
            userRole={userRole}
          />
        </TabsContent>

        <TabsContent value="financial">
          <FinancialTab
            projectId={projectId}
            userRole={userRole}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
