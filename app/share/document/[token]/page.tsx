import { getShareableDocument } from "@/app/actions/documents"
import { Download, FileText } from "lucide-react"

interface PageProps {
  params: Promise<{ token: string }>
}

const CATEGORY_COLOURS: Record<string, string> = {
  Drawings:           "bg-indigo-100 text-indigo-700",
  Specifications:     "bg-purple-100 text-purple-700",
  "Site Photos":      "bg-yellow-100 text-yellow-700",
  Contracts:          "bg-red-100 text-red-700",
  Reports:            "bg-blue-100 text-blue-700",
  "Client Shared":    "bg-teal-100 text-teal-700",
  "Contractor Shared":"bg-orange-100 text-orange-700",
}

export default async function PublicSharePage({ params }: PageProps) {
  const { token } = await params
  const doc = await getShareableDocument(token)

  // ─── Invalid / expired ────────────────────────────────────────────────────────
  if (!doc) {
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
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Link Unavailable</h1>
          <p className="text-white/60 text-sm max-w-sm mx-auto">
            This link has expired or is invalid. Please contact the person who shared it with you.
          </p>
          <p className="text-white/30 text-xs mt-8">Shared via ProjectFlow</p>
        </div>
      </div>
    )
  }

  const categoryBadge = CATEGORY_COLOURS[doc.category] ?? "bg-gray-100 text-gray-700"

  // ─── Valid share page ─────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#f8f8fc", fontFamily: "Inter, sans-serif" }}
    >
      {/* Header bar */}
      <header
        className="px-6 py-4 flex items-center gap-3"
        style={{ background: "#1a1a2e" }}
      >
        <div
          className="w-8 h-8 rounded flex items-center justify-center font-bold text-white text-sm"
          style={{ background: "#e94560" }}
        >
          PF
        </div>
        <span className="text-white font-semibold text-sm">ProjectFlow</span>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-2xl shadow-sm border p-8 flex flex-col gap-6">
            {/* Icon + name */}
            <div className="flex items-start gap-4">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "#1a1a2e" }}
              >
                <FileText className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold leading-snug">{doc.name}</h1>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryBadge}`}>
                    {doc.category}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                    v{doc.version_number} — Latest Issued
                  </span>
                </div>
              </div>
            </div>

            {/* Meta */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {doc.uploader && (
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Uploaded by</p>
                  <p className="font-medium">{doc.uploader.name}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Upload date</p>
                <p className="font-medium">
                  {new Date(doc.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
              {doc.file_size_bytes && (
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">File size</p>
                  <p className="font-medium">
                    {doc.file_size_bytes < 1024 * 1024
                      ? `${(doc.file_size_bytes / 1024).toFixed(1)} KB`
                      : `${(doc.file_size_bytes / (1024 * 1024)).toFixed(1)} MB`}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500 mb-0.5">File type</p>
                <p className="font-medium uppercase text-xs">{doc.file_type || "—"}</p>
              </div>
            </div>

            {/* Description */}
            {doc.description && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Description</p>
                <p className="text-sm text-gray-700">{doc.description}</p>
              </div>
            )}

            {/* Tags */}
            {doc.tags && doc.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {doc.tags.map((tag) => (
                  <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Download CTA */}
            <a
              href={doc.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-lg font-semibold text-white text-sm transition-opacity hover:opacity-90"
              style={{ background: "#e94560" }}
            >
              <Download className="w-4 h-4" />
              Download Document
            </a>

            {/* Share info */}
            {doc.share_token_expires_at && (
              <p className="text-xs text-center text-gray-400">
                This link expires on{" "}
                {new Date(doc.share_token_expires_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center pb-6 text-xs" style={{ color: "#999" }}>
        Shared via ProjectFlow
      </footer>
    </div>
  )
}
