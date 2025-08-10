import { NextResponse } from "next/server"
import { getIssues } from "@/lib/jira-api"
import type { FilterOptions } from "@/types/jira"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const projectKey = searchParams.get("project")

    if (!projectKey) {
      return NextResponse.json({ error: "Project key is required" }, { status: 400 })
    }

    // Parse filters from query parameters
    const filters: FilterOptions = {}

    const status = searchParams.get("status")
    if (status) filters.status = status.split(",")

    const priority = searchParams.get("priority")
    if (priority) filters.priority = priority.split(",")

    const assignee = searchParams.get("assignee")
    if (assignee) filters.assignee = assignee.split(",")

    const issueType = searchParams.get("issueType")
    if (issueType) filters.issueType = issueType.split(",")

    const labels = searchParams.get("labels")
    if (labels) filters.labels = labels.split(",")

    const components = searchParams.get("components")
    if (components) filters.components = components.split(",")

    const sprint = searchParams.get("sprint")
    if (sprint) filters.sprint = sprint.split(",")

    const release = searchParams.get("release")
    if (release) filters.release = release.split(",")

    const dueDateFrom = searchParams.get("dueDateFrom")
    if (dueDateFrom) filters.dueDateFrom = dueDateFrom

    const dueDateTo = searchParams.get("dueDateTo")
    if (dueDateTo) filters.dueDateTo = dueDateTo

    const issues = await getIssues(projectKey, filters)
    return NextResponse.json(issues)
  } catch (error) {
    console.error("API Error fetching issues:", error)
    return NextResponse.json({ error: "Failed to fetch issues" }, { status: 500 })
  }
}
