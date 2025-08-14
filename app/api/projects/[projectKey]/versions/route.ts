import { NextResponse } from 'next/server'
import { getProjectVersions } from '@/lib/jira-api'

export async function GET(
  request: Request,
  ctx: { params: Promise<{ projectKey: string }> }
) {
  try {
    const { projectKey } = await ctx.params
    const versions = await getProjectVersions(projectKey)
    return NextResponse.json(versions)
  } catch (error) {
    console.error('API Error fetching project versions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch project versions' },
      { status: 500 }
    )
  }
}
