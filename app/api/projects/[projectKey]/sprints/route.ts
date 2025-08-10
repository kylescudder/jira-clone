import { NextResponse } from "next/server"
import { getProjectSprints } from "@/lib/jira-api"

export async function GET(request: Request, { params }: { params: { projectKey: string } }) {
  try {
    const sprints = await getProjectSprints(params.projectKey)
    return NextResponse.json(sprints)
  } catch (error) {
    console.error("API Error fetching project sprints:", error)
    return NextResponse.json({ error: "Failed to fetch project sprints" }, { status: 500 })
  }
}
