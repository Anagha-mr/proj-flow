import Link from "next/link"
import { getPortalProject, logPortalView } from "@/app/actions/client-portal"
import { Progress } from "@/components/ui/progress"

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  on_hold: "bg-amber-100 text-amber-700",
  completed: "bg-blue-100 text-blue-700",
  archived: "bg-gray-100 text-gray-500",
  draft: "bg-gray-100 text-gray-500",
  sent: "bg-blue-100 text-blue-700",
  partial: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  todo: "bg-slate-100 text-slate-600",
  in_progress: "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-700",
}

const PHASE_BADGE: Record<string, string> = {
  before: "bg-blue-100 text-blue-700",
  during: "bg-amber-100 text-amber-700",
  after: "bg-green-100 text-green-700",
}

function formatINR(amount: number) {
  return amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
}

export default async function PortalProjectDetailPage({
  params,
}: {
  params: Promise<{ token: string; projectId: string }>
}) {
  const { token, projectId } = await params

  let project: Awaited<ReturnType<typeof getPortalProject>> | null = null
  try {
    project = await getPortalProject(token, projectId)
  } catch {
    return (
      <div className="text-center py-20 text-gray-500">
        <p className="text-base font-medium">Unable to load this project.</p>
        <p className="text-sm mt-1">Please contact your designer.</p>
      </div>
    )
  }

  logPortalView(token, projectId).catch(() => {})

  const totalPhases = project.phases.length
  const completedPhases = project.phases.filter((p) => p.status === "completed" || p.status === "done").length
  const { total, completed, in_progress, todo } = project.task_counts

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/portal/${token}`} className="text-[#e94560] text-sm hover:underline">
          ← Projects
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {project.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={project.cover_image_url} alt={project.name} className="w-full h-40 object-cover" />
        ) : (
          <div className="w-full h-40 bg-gradient-to-br from-[#1a1a2e] to-[#2d2d4e]" />
        )}
        <div className="p-5">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[project.status] ?? STATUS_BADGE.active}`}>
              {project.status.replace("_", " ")}
            </span>
          </div>
        </div>
      </div>

      {/* Overview */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total", value: total, cls: "text-gray-700" },
            { label: "Completed", value: completed, cls: "text-green-600" },
            { label: "In Progress", value: in_progress, cls: "text-blue-600" },
            { label: "To Do", value: todo, cls: "text-slate-500" },
          ].map(({ label, value, cls }) => (
            <div key={label} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 text-center">
              <p className={`text-2xl font-bold ${cls}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {totalPhases > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Phase Timeline</h3>
            <div className="space-y-3">
              {project.phases.map((phase, idx) => {
                const isDone = phase.status === "completed" || phase.status === "done"
                const isActive = !isDone && idx === completedPhases
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full shrink-0 ${isDone ? "bg-[#e94560]" : isActive ? "bg-[#1a1a2e]" : "bg-gray-200"}`} />
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${isDone ? "text-gray-500 line-through" : "text-gray-900"}`}>{phase.name}</p>
                      {(phase.start_date || phase.end_date) && (
                        <p className="text-xs text-gray-400">{phase.start_date} → {phase.end_date}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {project.site_updates_preview.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Latest Site Photos</h3>
              <Link href={`#site-photos`} className="text-xs text-[#e94560] hover:underline">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {project.site_updates_preview.map((u) =>
                u.photos.slice(0, 1).map((photo, pi) => (
                  <div key={`${u.id}-${pi}`} className="aspect-square rounded-md overflow-hidden bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo} alt="site" className="w-full h-full object-cover" />
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </section>

      {/* Procurement */}
      {project.procurement_schedules.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Procurement</h2>
          <div className="space-y-3">
            {project.procurement_schedules.map((schedule) => (
              <div key={schedule.id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">{schedule.name}</p>
                </div>
                <Link
                  href={`/portal/${token}/${projectId}/procurement`}
                  className="shrink-0 text-sm bg-[#1a1a2e] text-white px-3 py-1.5 rounded hover:bg-[#2d2d4e] transition-colors"
                >
                  Review & Approve →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Invoices */}
      {project.invoices.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Invoices</h2>
            <Link href={`/portal/${token}/${projectId}/invoices`} className="text-xs text-[#e94560] hover:underline">
              View all →
            </Link>
          </div>
          <div className="space-y-3">
            {project.invoices.slice(0, 3).map((inv) => (
              <div key={inv.id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-medium text-sm text-gray-900">{inv.invoice_number}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[inv.status] ?? STATUS_BADGE.sent}`}>
                    {inv.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>{formatINR(inv.total)}</span>
                  <a
                    href={`/api/finance/invoice-pdf?invoiceId=${inv.id}&portalToken=${token}`}
                    className="text-[#e94560] text-xs hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Download PDF
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Site Photos */}
      <section id="site-photos">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Site Photos</h2>
        {project.site_updates.length === 0 ? (
          <div className="bg-white rounded-lg border border-dashed border-gray-200 p-10 text-center text-gray-400 text-sm">
            No site photos yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {project.site_updates.map((update) => (
              <div key={update.id} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                {update.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={update.photos[0]}
                    alt="site update"
                    className="w-full aspect-[4/3] object-cover"
                  />
                ) : (
                  <div className="w-full aspect-[4/3] bg-gray-100" />
                )}
                <div className="p-3">
                  {update.phase_tag && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PHASE_BADGE[update.phase_tag] ?? ""}`}>
                      {update.phase_tag}
                    </span>
                  )}
                  {update.space_tag && (
                    <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {update.space_tag}
                    </span>
                  )}
                  {update.status_note && (
                    <p className="text-xs text-gray-600 mt-2 line-clamp-2">{update.status_note}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(update.submitted_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
