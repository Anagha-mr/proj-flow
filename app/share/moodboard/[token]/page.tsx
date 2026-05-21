import { getMoodboardByShareToken } from "@/app/actions/moodboards"
import { MoodboardActionPanel } from "./action-panel"
import { createClient } from "@supabase/supabase-js"

interface PageProps {
  params: Promise<{ token: string }>
}

async function getStudio(studioId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from as any)("studios")
    .select("name, logo_url")
    .eq("id", studioId)
    .single()
  return data as { name: string; logo_url: string | null } | null
}

export default async function MoodboardSharePage({ params }: PageProps) {
  const { token } = await params
  const moodboard = await getMoodboardByShareToken(token)

  if (!moodboard) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#1a1a2e", fontFamily: "Inter, sans-serif" }}
      >
        <div className="text-center px-6">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: "#e94560" }}
          >
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Moodboard Unavailable</h1>
          <p className="text-white/60 text-sm max-w-sm mx-auto">
            This moodboard is not available for viewing. Please contact your designer.
          </p>
          <p className="text-white/30 text-xs mt-8">Powered by ProjectFlow</p>
        </div>
      </div>
    )
  }

  const studio = await getStudio(moodboard.studio_id)
  const isApproved = moodboard.status === "approved"
  const canAct = moodboard.status === "shared_with_client" && !isApproved

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#f8f8fc", fontFamily: "Inter, sans-serif" }}
    >
      {/* Header */}
      <header className="px-6 py-4 flex items-center gap-3" style={{ background: "#1a1a2e" }}>
        {studio?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={studio.logo_url} alt={studio.name} className="w-10 h-10 rounded object-cover" />
        ) : (
          <div
            className="w-10 h-10 rounded flex items-center justify-center font-bold text-white text-sm"
            style={{ background: "#e94560" }}
          >
            {(studio?.name ?? "PF").slice(0, 2).toUpperCase()}
          </div>
        )}
        <span className="text-white font-semibold text-sm">{studio?.name ?? "ProjectFlow"}</span>
      </header>

      {/* Main */}
      <main className="flex-1 px-4 py-8 max-w-3xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{moodboard.title}</h1>
        {moodboard.description && (
          <p className="text-gray-500 text-sm mb-6">{moodboard.description}</p>
        )}

        {/* Embed */}
        <div className="rounded-lg overflow-hidden border border-gray-200 mb-8">
          {moodboard.canva_embed_url ? (
            <iframe
              src={moodboard.canva_embed_url}
              allowFullScreen
              loading="lazy"
              className="border-0 w-full"
              style={{ height: "clamp(360px, 55vw, 600px)" }}
              title={moodboard.title}
            />
          ) : moodboard.canva_export_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={moodboard.canva_export_url}
              alt={moodboard.title}
              className="w-full object-contain"
              style={{ maxHeight: 600 }}
            />
          ) : (
            <div
              className="w-full flex items-center justify-center text-gray-400 text-sm"
              style={{ height: 360 }}
            >
              Design preview not available
            </div>
          )}
        </div>

        {/* Approved banner */}
        {isApproved && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-6 flex items-center gap-3">
            <svg className="w-6 h-6 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="font-semibold text-green-800">Approved</p>
              <p className="text-sm text-green-700">
                Approved by {moodboard.client_approved_by}
                {moodboard.client_approved_at && (
                  <>
                    {" on "}
                    {new Date(moodboard.client_approved_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Action panel */}
        {canAct && <MoodboardActionPanel shareToken={token} />}
      </main>

      <footer className="text-center pb-6 text-xs text-gray-400">
        Powered by ProjectFlow
      </footer>
    </div>
  )
}
