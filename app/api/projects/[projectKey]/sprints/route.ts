import { NextResponse } from 'next/server'
import { getProjectSprints } from '@/lib/jira-api'

export async function GET(
  request: Request,
  ctx: { params: Promise<{ projectKey: string }> }
) {
  try {
    const { projectKey } = await ctx.params
    const sprints = await getProjectSprints(projectKey)
    return NextResponse.json(sprints)
  } catch (error) {
    console.error('API Error fetching project sprints:', error)
    return NextResponse.json(
      { error: 'Failed to fetch project sprints' },
      { status: 500 }
    )
  }
}
