"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { UserPlus } from "lucide-react"
import type { TeamMember, Announcement, LeavePolicy } from "@/app/actions/team"
import { TeamMembersTab } from "./team-members-tab"
import { LeaveTab } from "./leave-tab"
import { PayrollTab } from "./payroll-tab"
import { AnnouncementsSection } from "./announcements-section"
import { TeamInviteSheet } from "./team-invite-sheet"

interface Props {
  initialMembers: TeamMember[]
  initialAnnouncements: Announcement[]
  initialLeavePolicy: LeavePolicy | null
  currentUserRole: string
  currentUserId: string
}

export function TeamPageClient({
  initialMembers,
  initialAnnouncements,
  initialLeavePolicy,
  currentUserRole,
  currentUserId,
}: Props) {
  const [inviteOpen, setInviteOpen] = useState(false)
  const [members, setMembers] = useState(initialMembers)
  const [announcements, setAnnouncements] = useState(initialAnnouncements)

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

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Team Members</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          {currentUserRole === "owner" && (
            <TabsTrigger value="payroll">Payroll</TabsTrigger>
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
