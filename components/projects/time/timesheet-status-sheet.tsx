"use client"

import { useState, useEffect, useCallback } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, CheckCircle2, AlertCircle } from "lucide-react"
import { format, startOfWeek, addWeeks, subWeeks } from "date-fns"
import { getWeeklyTimesheetStatus } from "@/app/actions/time-tracking"

interface TimesheetStatusSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
}

type UserStatus = { user_id: string; name: string; hours: number; has_submitted: boolean }

export function TimesheetStatusSheet({ open, onOpenChange }: TimesheetStatusSheetProps) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [data, setData] = useState<UserStatus[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (ws: Date) => {
    setLoading(true)
    try {
      const result = await getWeeklyTimesheetStatus(ws.toISOString().split("T")[0])
      setData(result)
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) load(weekStart)
  }, [open, weekStart, load])

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const weekLabel = `Week of ${format(weekStart, "d MMM")} – ${format(weekEnd, "d MMM yyyy")}`

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[500px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Weekly Timesheet Status</SheetTitle>
        </SheetHeader>

        <div className="flex items-center justify-between mt-6 mb-4">
          <Button variant="ghost" size="icon" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <p className="text-sm font-medium text-center">{weekLabel}</p>
          <Button variant="ghost" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2 mt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center mt-8">No team members found.</p>
        ) : (
          <div className="flex flex-col gap-0 border rounded-lg overflow-hidden">
            <div className="grid grid-cols-4 gap-2 px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b">
              <span className="col-span-2">Member</span>
              <span className="text-right">Hours</span>
              <span className="text-right">Status</span>
            </div>
            {data.map((row) => (
              <div
                key={row.user_id}
                className={`grid grid-cols-4 gap-2 items-center px-4 py-3 border-b last:border-0 ${!row.has_submitted ? "bg-amber-50" : "bg-white"}`}
              >
                <span className="col-span-2 text-sm font-medium truncate">{row.name}</span>
                <span className="text-sm text-right font-semibold">{row.hours}h</span>
                <div className="flex items-center justify-end gap-1">
                  {row.has_submitted ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-xs text-green-700">Logged</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                      <span className="text-xs text-amber-700">None</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-4 text-center">
          WhatsApp reminders available in Sprint 10.
        </p>
      </SheetContent>
    </Sheet>
  )
}
