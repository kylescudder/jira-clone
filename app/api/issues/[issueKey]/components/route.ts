import { NextResponse } from 'next/server'
import { updateIssueComponents } from '@/lib/jira-api'

export async function PUT(
  request: Request,
  ctx: { params: Promise<{ issueKey: string }> }
) {
  try {
    const { issueKey } = await ctx.params
    const body = await request.json()
    const rawComponentId = body?.componentId

    const componentId =
      typeof rawComponentId === 'string' && rawComponentId.trim()
        ? rawComponentId
        : null

    const ok = await updateIssueComponents(issueKey, componentId)
    if (!ok) {
      return NextResponse.json(
        { error: 'Failed to update components' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API error updating components:', error)
    return NextResponse.json(
      { error: 'Failed to update components' },
      { status: 500 }
    )
  }
}
