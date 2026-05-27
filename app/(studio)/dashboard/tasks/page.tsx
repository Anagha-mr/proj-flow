import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

/**
 * Studio-level Tasks page — Sprint 15 nav stub.
 * Redirects to Projects for now; a cross-project task board
 * will be built in a future sprint.
 */
export default async function StudioTasksPage() {
  // For now: redirect to projects where tasks live per-project
  redirect("/dashboard/projects")
}
