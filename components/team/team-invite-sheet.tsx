"use client"

import { useState, useTransition } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { inviteTeamMember } from "@/app/actions/team"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TeamInviteSheet({ open, onOpenChange }: Props) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<'senior_designer' | 'designer' | 'intern'>("designer")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    startTransition(async () => {
      try {
        await inviteTeamMember(email.trim(), role)
        toast({ title: `Invite sent to ${email.trim()}` })
        setEmail("")
        setRole("designer")
        onOpenChange(false)
      } catch (err: unknown) {
        toast({ title: (err as Error).message, variant: "destructive" })
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[400px]">
        <SheetHeader>
          <SheetTitle>Invite Team Member</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1">
            <Label>Email Address</Label>
            <Input
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <Select value={role} onValueChange={v => setRole(v as typeof role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="senior_designer">Senior Designer</SelectItem>
                <SelectItem value="designer">Designer</SelectItem>
                <SelectItem value="intern">Intern</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Sending…" : "Send Invite"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
