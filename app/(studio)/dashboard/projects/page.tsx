import type { Metadata } from "next"
import { getProjects } from "@/app/actions/projects"
import { ProjectsClient } from "@/components/projects/projects-client"

export const metadata: Metadata = { title: "Projects" }

export default async function ProjectsPage() {
  const projects = await getProjects()
  return <ProjectsClient initialProjects={projects} />
}
