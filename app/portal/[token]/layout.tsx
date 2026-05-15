import { getPortalClient } from "@/app/actions/client-portal"

export default async function PortalTokenLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  let portalClient: { id: string; name: string; studio: { name: string; logo_url: string | null } } | null = null

  try {
    portalClient = await getPortalClient(token)
  } catch {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <p className="text-lg font-semibold text-gray-800 mb-2">This link has expired or is invalid.</p>
          <p className="text-sm text-gray-500">Please contact your designer for a new link.</p>
        </div>
      </div>
    )
  }

  const { studio, name: clientName } = portalClient

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Topbar */}
      <header className="bg-[#1a1a2e] text-white sticky top-0 z-50 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {studio.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={studio.logo_url}
                alt={studio.name}
                className="h-10 w-10 object-contain rounded"
              />
            ) : (
              <div className="h-10 w-10 rounded bg-[#e94560] flex items-center justify-center font-bold text-sm">
                {studio.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="font-semibold text-sm tracking-wide">{studio.name}</span>
          </div>
          <span className="text-sm text-white/70 truncate max-w-[140px] text-right">{clientName}</span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-gray-400">
        Powered by ProjectFlow
      </footer>
    </div>
  )
}
