"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { UserPlus } from "lucide-react"
import type { TeamMember, Announcement, LeavePolicy } from "@/app/actions/team"
import type { BusyBlock, ResourceConflict } from "@/app/actions/calendar"
import { TeamMembersTab } from "./team-members-tab"
import { LeaveTab } from "./leave-tab"
import { PayrollTab } from "./payroll-tab"
import { AnnouncementsSection } from "./announcements-section"
import { TeamInviteSheet } from "./team-invite-sheet"
import { ResourceAllocationView } from "./resource-allocation-view"

interface Props {
  initialMembers: TeamMember[]
  initialAnnouncements: Announcement[]
  initialLeavePolicy: LeavePolicy | null
  currentUserRole: string
  currentUserId: string
  initialBusyBlocks: BusyBlock[]
  initialConflicts: ResourceConflict[]
  teamMembersWithCalendar: { id: string; full_name: string; calendar_connected: boolean }[]
  weekStart: string
}

export function TeamPageClient({
  initialMembers,
  initialAnnouncements,
  initialLeavePolicy,
  currentUserRole,
  currentUserId,
  initialBusyBlocks,
  initialConflicts,
  teamMembersWithCalendar,
  weekStart,
}: Props) {
  const searchParams = useSearchParams()
  const defaultTab = searchParams.get("tab") ?? "members"

  const [inviteOpen, setInviteOpen] = useState(false)
  const [members, setMembers] = useState(initialMembers)
  const [announcements, setAnnouncements] = useState(initialAnnouncements)

  const canManageTeam = currentUserRole === "owner" || currentUserRole === "senior_designer"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Team</h1>
        {currentUserRole === "owner" && (
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Invite
          </Button>
        )}
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="members">Team Members</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          {currentUserRole === "owner" && (
            <TabsTrigger value="payroll">Payroll</TabsTrigger>
          )}
          {canManageTeam && (
            <TabsTrigger value="availability">Availability</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="members" className="mt-4">
          <TeamMembersTab
            members={members}
            currentUserRole={currentUserRole}
            currentUserId={currentUserId}
            onMembersChange={setMembers}
          />
        </TabsContent>

        <TabsContent value="leave" className="mt-4">
          <LeaveTab
            members={members}
            currentUserRole={currentUserRole}
            currentUserId={currentUserId}
          />
        </TabsContent>

        {currentUserRole === "owner" && (
          <TabsContent value="payroll" className="mt-4">
            <PayrollTab members={members} />
          </TabsContent>
        )}

        {canManageTeam && (
          <TabsContent value="availability" className="mt-4">
            <ResourceAllocationView
              busyBlocks={initialBusyBlocks}
              conflicts={initialConflicts}
              teamMembers={teamMembersWithCalendar}
              weekStart={weekStart}
            />
          </TabsContent>
        )}
      </Tabs>

      <AnnouncementsSection
        announcements={announcements}
        currentUserRole={currentUserRole}
        onAnnouncementsChange={setAnnouncements}
      />

      <TeamInviteSheet open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  )
}
