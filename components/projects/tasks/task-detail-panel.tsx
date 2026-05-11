"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import {
  X, Plus, Trash2, Paperclip, MessageSquare, Eye, EyeOff, ChevronRight,
  FileText, ImageIcon, Upload, AlertCircle
} from "lucide-react"
import { format, formatDistanceToNow, differenceInDays } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import {
  updateTask,
  deleteTask,
  getSubtasks,
  createTask,
  getTaskComments,
  addTaskComment,
  deleteTaskComment,
  getTaskAttachments,
  addTaskAttachment,
  deleteTaskAttachment,
  addTaskAssignee,
  removeTaskAssignee,
  addTaskDependency,
  removeTaskDependency,
} from "@/app/actions/tasks"
import type { TaskWithDetails, TaskComment, TaskAttachment } from "@/app/actions/tasks"

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#e94560",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#10b981",
}

const STATUS_OPTIONS = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
]

const PRIORITY_OPTIONS = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
]

type StudioUser = { id: string; name: string; profile_photo_url: string | null; role: string }
type PhaseItem = { id: string; name: string; color: string }

type DepEntry = {
  task_id: string
  depends_on_task_id: string
  depends_on_task: { id: string; title: string; status: string }
}

interface Props {
  task: TaskWithDetails | null
  open: boolean
  onClose: () => void
  projectPhases: PhaseItem[]
  studioUsers: StudioUser[]
  currentUserId: string
  onUpdateTask: (id: string, updates: Partial<TaskWithDetails>) => void
  onDeleteTask: (id: string) => void
  onCreateSubtask?: (subtask: TaskWithDetails) => void
  dependencies?: DepEntry[]
  allProjectTasks?: TaskWithDetails[]
  onDependencyChange?: () => void
}

export function TaskDetailPanel({
  task,
  open,
  onClose,
  projectPhases,
  studioUsers,
  currentUserId,
  onUpdateTask,
  onDeleteTask,
  dependencies = [],
  allProjectTasks = [],
  onDependencyChange,
}: Props) {
  const { toast } = useToast()
  const [subtasks, setSubtasks] = useState<TaskWithDetails[]>([])
  const [comments, setComments] = useState<TaskComment[]>([])
  const [attachments, setAttachments] = useState<TaskAttachment[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Edit states
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editProgress, setEditProgress] = useState(0)
  const [editRoomTag, setEditRoomTag] = useState("")

  // UI states
  const [commentBody, setCommentBody] = useState("")
  const [commentClientVisible, setCommentClientVisible] = useState(false)
  const [postingComment, setPostingComment] = useState(false)
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("")
  const [addingSubtask, setAddingSubtask] = useState(false)
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [nestedTask, setNestedTask] = useState<TaskWithDetails | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load task detail data when task changes
  useEffect(() => {
    if (!task) return
    setEditTitle(task.title)
    setEditDescription(task.description ?? "")
    setEditProgress(task.progress_percent ?? 0)
    setEditRoomTag(task.room_tag ?? "")
    setLoadingDetail(true)
    Promise.all([
      getSubtasks(task.id),
      getTaskComments(task.id),
      getTaskAttachments(task.id),
    ])
      .then(([subs, cmts, atts]) => {
        setSubtasks(subs)
        setComments(cmts)
        setAttachments(atts)
      })
      .catch(() => toast({ title: "Failed to load task details", variant: "destructive" }))
      .finally(() => setLoadingDetail(false))
  }, [task?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveField = useCallback(
    async (field: string, value: unknown) => {
      if (!task) return
      try {
        await updateTask(task.id, { [field]: value } as Parameters<typeof updateTask>[1])
        onUpdateTask(task.id, { [field]: value } as Partial<TaskWithDetails>)
      } catch {
        toast({ title: "Failed to save", variant: "destructive" })
      }
    },
    [task, onUpdateTask, toast]
  )

  // Auto-calculated progress from subtasks
  const autoProgress =
    subtasks.length > 0
      ? Math.round((subtasks.filter((s) => s.status === "done").length / subtasks.length) * 100)
      : null

  const displayProgress = autoProgress ?? editProgress

  const duration =
    task?.start_date && task?.due_date
      ? Math.max(1, differenceInDays(new Date(task.due_date), new Date(task.start_date)))
      : null

  if (!task) return null

  const currentAssigneeIds = task.assignees.map((a) => a.id)
  const unassignedUsers = studioUsers.filter((u) => !currentAssigneeIds.includes(u.id))

  async function handleAddAssignee(userId: string) {
    try {
      await addTaskAssignee(task!.id, userId)
      const user = studioUsers.find((u) => u.id === userId)!
      onUpdateTask(task!.id, {
        assignees: [...task!.assignees, { id: user.id, name: user.name, profile_photo_url: user.profile_photo_url }],
      })
      setAssigneePopoverOpen(false)
    } catch {
      toast({ title: "Failed to add assignee", variant: "destructive" })
    }
  }

  async function handleRemoveAssignee(userId: string) {
    try {
      await removeTaskAssignee(task!.id, userId)
      onUpdateTask(task!.id, { assignees: task!.assignees.filter((a) => a.id !== userId) })
    } catch {
      toast({ title: "Failed to remove assignee", variant: "destructive" })
    }
  }

  async function handleAddSubtask() {
    if (!newSubtaskTitle.trim()) return
    setAddingSubtask(true)
    try {
      const sub = await createTask({
        project_id: task!.project_id,
        title: newSubtaskTitle.trim(),
        parent_task_id: task!.id,
        status: "todo",
        assignee_ids: [currentUserId],
      })
      setSubtasks((prev) => [...prev, sub])
      setNewSubtaskTitle("")
      onUpdateTask(task!.id, { subtask_count: (task!.subtask_count ?? 0) + 1 })
    } catch {
      toast({ title: "Failed to add subtask", variant: "destructive" })
    } finally {
      setAddingSubtask(false)
    }
  }

  async function handleSubtaskCheck(subtaskId: string, done: boolean) {
    const newStatus = done ? "done" : "todo"
    setSubtasks((prev) => prev.map((s) => (s.id === subtaskId ? { ...s, status: newStatus } : s)))
    try {
      await updateTask(subtaskId, { status: newStatus })
    } catch {
      toast({ title: "Failed to update subtask", variant: "destructive" })
    }
  }

  async function handlePostComment() {
    if (!commentBody.trim()) return
    setPostingComment(true)
    try {
      const comment = await addTaskComment(task!.id, commentBody.trim(), commentClientVisible)
      setComments((prev) => [...prev, comment])
      setCommentBody("")
    } catch {
      toast({ title: "Failed to post comment", variant: "destructive" })
    } finally {
      setPostingComment(false)
    }
  }

  async function handleDeleteComment(commentId: string) {
    try {
      await deleteTaskComment(commentId)
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    } catch {
      toast({ title: "Failed to delete comment", variant: "destructive" })
    }
  }

  async function handleFileUpload(file: File) {
    setUploadingFile(true)
    try {
      const supabase = createClient()
      const path = `${task!.studio_id}/tasks/${task!.id}/${Date.now()}-${file.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("studio-files")
        .upload(path, file, { cacheControl: "3600", upsert: false })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from("studio-files").getPublicUrl(uploadData.path)

      const att = await addTaskAttachment(task!.id, publicUrl, file.name, file.type, file.size)
      setAttachments((prev) => [att, ...prev])
      onUpdateTask(task!.id, { attachment_count: (task!.attachment_count ?? 0) + 1 })
    } catch {
      toast({ title: "Upload failed", variant: "destructive" })
    } finally {
      setUploadingFile(false)
    }
  }

  async function handleDeleteAttachment(attachmentId: string) {
    try {
      await deleteTaskAttachment(attachmentId)
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
      onUpdateTask(task!.id, { attachment_count: Math.max(0, (task!.attachment_count ?? 1) - 1) })
    } catch {
      toast({ title: "Failed to delete attachment", variant: "destructive" })
    }
  }

  async function handleDeleteTask() {
    try {
      await deleteTask(task!.id)
      onDeleteTask(task!.id)
      setDeleteDialogOpen(false)
      onClose()
    } catch {
      toast({ title: "Failed to delete task", variant: "destructive" })
    }
  }

  async function handleAddDependency(dependsOnTaskId: string) {
    try {
      await addTaskDependency(task!.id, dependsOnTaskId)
      onDependencyChange?.()
      toast({ title: "Dependency added" })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to add dependency"
      toast({ title: msg, variant: "destructive" })
    }
  }

  async function handleRemoveDependency(dependsOnTaskId: string) {
    try {
      await removeTaskDependency(task!.id, dependsOnTaskId)
      onDependencyChange?.()
      toast({ title: "Dependency removed" })
    } catch {
      toast({ title: "Failed to remove dependency", variant: "destructive" })
    }
  }

  const activeTask = nestedTask ?? task

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[480px] overflow-y-auto flex flex-col gap-0 p-0"
        >
          <SheetHeader className="px-5 pt-5 pb-3 border-b flex flex-row items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {nestedTask && (
                <button
                  onClick={() => setNestedTask(null)}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1"
                >
                  <ChevronRight className="w-3 h-3 rotate-180" />
                  Back to {task.title}
                </button>
              )}
              <input
                className="text-lg font-semibold bg-transparent border-none outline-none w-full focus:ring-0"
                value={nestedTask ? editTitle : editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={() => editTitle !== activeTask.title && saveField("title", editTitle)}
              />
            </div>
            <Button variant="ghost" size="icon" className="shrink-0 -mt-1" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </SheetHeader>

          {loadingDetail ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              Loading…
            </div>
          ) : (
            <div className="flex flex-col gap-0 overflow-y-auto flex-1">
              {/* Status selector */}
              <div className="px-5 py-3 border-b">
                <Select
                  value={activeTask.status}
                  onValueChange={(v) => saveField("status", v)}
                >
                  <SelectTrigger className="h-8 w-40 text-sm focus:ring-[#e94560]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Details section */}
              <div className="px-5 py-4 border-b flex flex-col gap-3">
                {/* Priority */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground w-20 shrink-0">Priority</span>
                  <div className="flex gap-1 flex-wrap">
                    {PRIORITY_OPTIONS.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => saveField("priority", p.value)}
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                          activeTask.priority === p.value
                            ? "border-transparent text-white"
                            : "border-border bg-background text-muted-foreground hover:border-foreground/30"
                        }`}
                        style={
                          activeTask.priority === p.value
                            ? { backgroundColor: PRIORITY_COLORS[p.value] }
                            : {}
                        }
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Phase tag */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20 shrink-0">Phase</span>
                  <Select
                    value={activeTask.phase_tag ?? "none"}
                    onValueChange={(v) => saveField("phase_tag", v === "none" ? null : v)}
                  >
                    <SelectTrigger className="h-7 text-xs flex-1 focus:ring-[#e94560]">
                      <SelectValue placeholder="No phase" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No phase</SelectItem>
                      {projectPhases.map((ph) => (
                        <SelectItem key={ph.id} value={ph.name}>{ph.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Room tag */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20 shrink-0">Room</span>
                  <Input
                    className="h-7 text-xs flex-1 focus-visible:ring-[#e94560]"
                    value={editRoomTag}
                    placeholder="e.g. Living Room"
                    onChange={(e) => setEditRoomTag(e.target.value)}
                    onBlur={() => editRoomTag !== (activeTask.room_tag ?? "") && saveField("room_tag", editRoomTag || null)}
                  />
                </div>

                {/* Dates */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20 shrink-0">Start</span>
                  <input
                    type="date"
                    className="h-7 text-xs border rounded px-2 bg-background flex-1 focus:ring-1 focus:ring-[#e94560] focus:outline-none"
                    value={activeTask.start_date ?? ""}
                    onChange={(e) => saveField("start_date", e.target.value || null)}
                  />
                  <span className="text-xs text-muted-foreground shrink-0">to</span>
                  <input
                    type="date"
                    className="h-7 text-xs border rounded px-2 bg-background flex-1 focus:ring-1 focus:ring-[#e94560] focus:outline-none"
                    value={activeTask.due_date ?? ""}
                    onChange={(e) => saveField("due_date", e.target.value || null)}
                  />
                </div>
                {duration !== null && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-20 shrink-0">Duration</span>
                    <span className="text-xs text-muted-foreground">{duration} day{duration !== 1 ? "s" : ""}</span>
                  </div>
                )}

                {/* Progress */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20 shrink-0">Progress</span>
                  {autoProgress !== null ? (
                    <span className="text-xs text-muted-foreground">
                      {autoProgress}% (auto from subtasks)
                    </span>
                  ) : (
                    <div className="flex items-center gap-2 flex-1">
                      <Slider
                        value={[editProgress]}
                        min={0}
                        max={100}
                        step={5}
                        className="flex-1"
                        onValueChange={([v]) => setEditProgress(v)}
                        onValueCommit={([v]) => saveField("progress_percent", v)}
                      />
                      <span className="text-xs w-8 text-right">{editProgress}%</span>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Description</span>
                  <Textarea
                    className="text-sm resize-none focus-visible:ring-[#e94560]"
                    rows={3}
                    value={editDescription}
                    placeholder="Add a description…"
                    onChange={(e) => setEditDescription(e.target.value)}
                    onBlur={() =>
                      editDescription !== (activeTask.description ?? "") &&
                      saveField("description", editDescription || null)
                    }
                  />
                </div>
              </div>

              {/* Assignees */}
              <div className="px-5 py-4 border-b">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium">Assignees</span>
                  <Popover open={assigneePopoverOpen} onOpenChange={setAssigneePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 text-xs px-2">
                        <Plus className="w-3 h-3 mr-1" />
                        Assign
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2" align="end">
                      {unassignedUsers.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2 text-center">All members assigned</p>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {unassignedUsers.map((u) => (
                            <button
                              key={u.id}
                              onClick={() => handleAddAssignee(u.id)}
                              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-sm w-full text-left"
                            >
                              <Avatar className="w-6 h-6">
                                <AvatarFallback className="bg-[#1a1a2e] text-white text-xs">
                                  {u.name.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              {u.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeTask.assignees.map((a) => (
                    <div key={a.id} className="flex items-center gap-1.5 bg-secondary rounded-full pl-1 pr-2 py-0.5">
                      <Avatar className="w-5 h-5">
                        <AvatarFallback className="bg-[#1a1a2e] text-white text-[10px]">
                          {a.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs">{a.name}</span>
                      <button
                        onClick={() => handleRemoveAssignee(a.id)}
                        className="text-muted-foreground hover:text-foreground ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {activeTask.assignees.length === 0 && (
                    <p className="text-xs text-muted-foreground">No assignees</p>
                  )}
                </div>
              </div>

              {/* Subtasks */}
              <div className="px-5 py-4 border-b">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium">
                    Subtasks
                    {subtasks.length > 0 && (
                      <span className="ml-1.5 text-muted-foreground">
                        {subtasks.filter((s) => s.status === "done").length}/{subtasks.length}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {subtasks.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center gap-2 group hover:bg-accent/30 rounded px-1 py-0.5"
                    >
                      <Checkbox
                        checked={sub.status === "done"}
                        onCheckedChange={(checked) => handleSubtaskCheck(sub.id, !!checked)}
                      />
                      <button
                        className={`flex-1 text-sm text-left ${sub.status === "done" ? "line-through text-muted-foreground" : ""}`}
                        onClick={() => setNestedTask(sub)}
                      >
                        {sub.title}
                      </button>
                      {sub.due_date && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {format(new Date(sub.due_date), "dd MMM")}
                        </span>
                      )}
                      <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Input
                    className="h-7 text-xs focus-visible:ring-[#e94560]"
                    placeholder="Add subtask…"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddSubtask()}
                  />
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-[#e94560] hover:bg-[#c73652]"
                    onClick={handleAddSubtask}
                    disabled={!newSubtaskTitle.trim() || addingSubtask}
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* Dependencies */}
              <div className="px-5 py-4 border-b">
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Depends On
                  </p>

                  {dependencies.map((dep) => (
                    <div
                      key={dep.depends_on_task_id}
                      className="flex items-center justify-between gap-2 p-2 rounded-md border text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                          dep.depends_on_task.status === "done"
                            ? "bg-green-500"
                            : dep.depends_on_task.status === "in_progress"
                            ? "bg-blue-500"
                            : "bg-gray-300"
                        }`} />
                        <span className="truncate">{dep.depends_on_task.title}</span>
                        {dep.depends_on_task.status !== "done" && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Dependency not yet complete" />
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveDependency(dep.depends_on_task_id)}
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 self-start">
                        <Plus className="w-3 h-3" />
                        Add dependency
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2" align="start">
                      <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                        {allProjectTasks
                          .filter(
                            (t) =>
                              t.id !== task.id &&
                              !dependencies.some((d) => d.depends_on_task_id === t.id)
                          )
                          .map((t) => (
                            <button
                              key={t.id}
                              onClick={() => handleAddDependency(t.id)}
                              className="text-left px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors truncate"
                            >
                              {t.title}
                            </button>
                          ))}
                        {allProjectTasks.filter(
                          (t) =>
                            t.id !== task.id &&
                            !dependencies.some((d) => d.depends_on_task_id === t.id)
                        ).length === 0 && (
                          <p className="text-xs text-muted-foreground p-2">No other tasks</p>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Attachments */}
              <div className="px-5 py-4 border-b">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium">Attachments ({attachments.length})</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                  >
                    <Upload className="w-3 h-3 mr-1" />
                    {uploadingFile ? "Uploading…" : "Upload"}
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileUpload(file)
                    e.target.value = ""
                  }}
                />
                {attachments.length === 0 ? (
                  <button
                    className="w-full border-2 border-dashed rounded-lg p-4 text-xs text-muted-foreground hover:border-foreground/30 transition-colors flex flex-col items-center gap-1"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="w-4 h-4" />
                    Click or drag files to upload
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {attachments.map((att) => {
                      const isImage = att.file_type?.startsWith("image/")
                      return (
                        <div
                          key={att.id}
                          className="relative group rounded-lg border bg-secondary/30 overflow-hidden"
                        >
                          {isImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={att.file_url}
                              alt={att.file_name}
                              className="w-full h-20 object-cover"
                            />
                          ) : (
                            <div className="w-full h-20 flex items-center justify-center">
                              <FileText className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )}
                          <div className="p-1.5">
                            <p className="text-xs font-medium truncate">{att.file_name}</p>
                            {att.file_size_bytes && (
                              <p className="text-[10px] text-muted-foreground">
                                {(att.file_size_bytes / 1024).toFixed(0)} KB
                              </p>
                            )}
                          </div>
                          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                            <a
                              href={att.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-background/80 rounded p-1"
                            >
                              <ImageIcon className="w-3 h-3" />
                            </a>
                            <button
                              className="bg-background/80 rounded p-1 text-destructive"
                              onClick={() => handleDeleteAttachment(att.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Comments */}
              <div className="px-5 py-4 border-b">
                <div className="flex items-center gap-1.5 mb-3">
                  <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium">Comments ({comments.length})</span>
                </div>
                <div className="flex flex-col gap-3 mb-3">
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-2 group">
                      <Avatar className="w-7 h-7 shrink-0 mt-0.5">
                        <AvatarFallback className="bg-[#1a1a2e] text-white text-xs">
                          {(c.author?.name ?? "?").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xs font-medium">{c.author?.name ?? "Unknown"}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                          </span>
                          {c.is_client_visible && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1">
                              Client visible
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs mt-0.5 break-words">{c.body}</p>
                      </div>
                      {c.author_id === currentUserId && (
                        <button
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => handleDeleteComment(c.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {comments.length === 0 && (
                    <p className="text-xs text-muted-foreground">No comments yet</p>
                  )}
                </div>
                <Textarea
                  className="text-xs resize-none focus-visible:ring-[#e94560] mb-2"
                  rows={2}
                  placeholder="Write a comment… (Cmd+Enter to post)"
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handlePostComment()
                  }}
                />
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setCommentClientVisible((v) => !v)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {commentClientVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    {commentClientVisible ? "Client visible" : "Internal only"}
                  </button>
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-[#e94560] hover:bg-[#c73652]"
                    onClick={handlePostComment}
                    disabled={!commentBody.trim() || postingComment}
                  >
                    Post
                  </Button>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10 w-full"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Delete task
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="sr-only">Task Details</DialogTitle>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-destructive" />
              Delete task
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{task.title}&rdquo;? This will also delete all subtasks, comments, and attachments. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteTask}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
