import { redirect } from "next/navigation"

/**
 * Studio-level Documents page — Sprint 15 nav stub.
 * Redirects to Projects for now; a cross-project document library
 * will be built in a future sprint.
 */
export default async function StudioDocumentsPage() {
  redirect("/dashboard/projects")
}
