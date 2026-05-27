import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getMoodboards } from "@/app/actions/moodboards"
import { getCanvaConnectionStatus } from "@/app/actions/canva"
import { MoodboardTab } from "@/components/projects/moodboard/moodboard-tab"

export default async function ProjectMoodboardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) notFound()

  const { data: profile } = await supabase
    .from("users")
    .select("studio_id")
    .eq("id", user.id)
    .single()

  const [initialMoodboards, canvaStatus] = await Promise.all([
    getMoodboards(id).catch(() => []),
    getCanvaConnectionStatus().catch(() => ({
      connected: false, canva_user_id: null, token_expires_at: null, is_expired: false,
    })),
  ])

  return (
    <MoodboardTab
      projectId={id}
      studioId={profile?.studio_id ?? ""}
      canvaConnected={canvaStatus.connected && !canvaStatus.is_expired}
      initialMoodboards={initialMoodboards}
    />
  )
}
