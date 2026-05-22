"use client"

import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { format, parseISO } from "date-fns"
import type { TeamMember } from "@/app/actions/team"
import { MemberDetailPanel } from "./member-detail-panel"

function getInitials(member: TeamMember): string {
  if (member.full_name) {
    const parts = member.full_name.trim().split(" ")
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return parts[0][0].toUpperCase()
  }
  return member.email[0].toUpperCase()
}

const ROLE_BADGE: Record<string, string> = {
  owner: "bg-purple-100 text-purple-800",
  senior_designer: "bg-blue-100 text-blue-800",
  designer: "bg-green-100 text-green-800",
  intern: "bg-amber-100 text-amber-800",
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  senior_designer: "Senior Designer",
  designer: "Designer",
  intern: "Intern",
}

const EMPLOYMENT_BADGE: Record<string, string> = {
  full_time: "bg-slate-100 text-slate-700",
  part_time: "bg-orange-100 text-orange-700",
  contractor: "bg-cyan-100 text-cyan-700",
  intern: "bg-yellow-100 text-yellow-700",
}

const EMPLOYMENT_LABEL: Record<string, string> = {
  full_time: "Full Time",
  part_time: "Part Time",
  contractor: "Contractor",
  intern: "Intern",
}

interface Props {
  members: TeamMember[]
  currentUserRole: string
  currentUserId: string
  onMembersChange: (members: TeamMember[]) => void
}

export function TeamMembersTab({ members, currentUserRole, currentUserId, onMembersChange }: Props) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("active")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)

  const departments = useMemo(() => {
    const depts = [...new Set(members.map(m => m.department).filter(Boolean) as string[])]
    return depts.sort()
  }, [members])

  const filtered = useMemo(() => {
    return members.filter(m => {
      if (statusFilter === "active" && !m.is_active) return false
      if (statusFilter === "inactive" && m.is_active) return false
      if (departmentFilter !== "all" && m.department !== departmentFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          (m.full_name ?? "").toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          (m.designation ?? "").toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [members, search, statusFilter, departmentFilter])

  const handleMemberUpdated = (updated: TeamMember) => {
    onMembersChange(members.map(m => m.id === updated.id ? updated : m))
    setSelectedMember(updated)
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Input
          placeholder="Search by name, email or designation…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        {departments.length > 0 && (
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">No team members found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(member => (
            <Card
              key={member.id}
              className={`transition-opacity ${!member.is_active ? "opacity-50" : ""}`}
            >
              <CardContent className="pt-5 pb-4 px-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full shrink-0 overflow-hidden flex items-center justify-center bg-primary text-white font-semibold text-lg">
                    {member.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={member.avatar_url} alt={member.full_name ?? member.email} className="w-full h-full object-cover" />
                    ) : (
                      getInitials(member)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{member.full_name ?? member.email}</p>
                    {member.designation && (
                      <p className="text-xs text-muted-foreground truncate">{member.designation}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[member.role] ?? "bg-gray-100 text-gray-700"}`}>
                    {ROLE_LABEL[member.role] ?? member.role}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${EMPLOYMENT_BADGE[member.employment_type] ?? "bg-gray-100 text-gray-700"}`}>
                    {EMPLOYMENT_LABEL[member.employment_type] ?? member.employment_type}
                  </span>
                </div>

                <div className="text-xs text-muted-foreground mb-3">
                  {member.date_of_joining
                    ? `Joined: ${format(parseISO(member.date_of_joining), 'dd MMM yyyy')}`
                    : <span className="italic">No join date</span>
                  }
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className={`w-2 h-2 rounded-full ${member.is_active ? "bg-green-500" : "bg-slate-400"}`} />
                    <span className="text-muted-foreground">{member.is_active ? "Active" : "Inactive"}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setSelectedMember(member)}
                  >
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedMember && (
        <MemberDetailPanel
          member={selectedMember}
          currentUserRole={currentUserRole}
          currentUserId={currentUserId}
          open={!!selectedMember}
          onOpenChange={open => !open && setSelectedMember(null)}
          onUpdated={handleMemberUpdated}
        />
      )}
    </>
  )
}

export function TeamMembersSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="pt-5 pb-4 px-4">
            <div className="flex items-center gap-3 mb-3">
              <Skeleton className="w-12 h-12 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-3 w-full mb-2" />
            <Skeleton className="h-3 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
