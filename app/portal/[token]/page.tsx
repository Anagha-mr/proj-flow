import Link from "next/link"
import { getPortalProjects, logPortalView } from "@/app/actions/client-portal"
import { Progress } from "@/components/ui/progress"

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  on_hold: "bg-amber-100 text-amber-700",
  completed: "bg-blue-100 text-blue-700",
  archived: "bg-gray-100 text-gray-500",
}

export default async function PortalProjectsPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  let projects: Awaited<ReturnType<typeof getPortalProjects>> = []
  try {
    projects = await getPortalProjects(token)
  } catch {
    return (
      <div className="text-center py-20 text-gray-500">
        <p className="text-base font-medium">Unable to load your projects.</p>
        <p className="text-sm mt-1">Please try again or contact your designer.</p>
      </div>
    )
  }

  // Log portal view fire-and-forget
  if (projects.length > 0) {
    logPortalView(token, projects[0].id).catch(() => {})
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p className="text-base font-medium">No projects found.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Projects</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {projects.map((project) => {
          const phases = project.phases ?? []
          const totalPhases = phases.length
          const completedPhases = phases.filter((p) => p.status === "completed" || p.status === "done").length
          const phasePercent = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0
          const badgeClass = STATUS_BADGE[project.status] ?? STATUS_BADGE.active
          const { total, completed } = project.task_counts

          return (
            <Link key={project.id} href={`/portal/${token}/${project.id}`}>
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow overflow-hidden cursor-pointer">
                {project.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={project.cover_image_url}
                    alt={project.name}
                    className="w-full aspect-video object-cover"
                  />
                ) : (
                  <div className="w-full aspect-video bg-gradient-to-br from-[#1a1a2e] to-[#2d2d4e]" />
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h2 className="text-lg font-semibold text-gray-900 leading-tight">{project.name}</h2>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>
                      {project.status.replace("_", " ")}
                    </span>
                  </div>
                  {totalPhases > 0 && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Phase progress</span>
                        <span>{completedPhases}/{totalPhases}</span>
                      </div>
                      <Progress value={phasePercent} className="h-1.5" />
                    </div>
                  )}
                  <div className="text-xs text-gray-500">
                    <span className="bg-gray-100 rounded px-2 py-0.5 font-medium text-gray-700">
                      {completed}/{total} tasks done
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
