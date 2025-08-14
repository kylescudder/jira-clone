import { NextResponse } from 'next/server'
import { updateIssueFixVersions } from '@/lib/jira-api'

export async function PUT(
  request: Request,
  ctx: { params: Promise<{ issueKey: string }> }
) {
  try {
    const body = await request.json()
    const versionIds = Array.isArray(body?.versionIds) ? body.versionIds : []
    const { issueKey } = await ctx.params

    const ok = await updateIssueFixVersions(issueKey, versionIds)
    if (!ok) {
      return NextResponse.json(
        { error: 'Failed to update fix versions' },
        { status: 500 }
      )
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error updating fix versions:', error)
    return NextResponse.json(
      { error: 'Failed to update fix versions' },
      { status: 500 }
    )
  }
}
