import { NextResponse } from 'next/server'
import { updateIssueSprint } from '@/lib/jira-api'

export async function PUT(
  request: Request,
  ctx: { params: Promise<{ issueKey: string }> }
) {
  try {
    const { issueKey } = await ctx.params
    const { sprintId } = await request.json()

    const ok = await updateIssueSprint(issueKey, sprintId)
    if (!ok) {
      return NextResponse.json(
        { error: 'Failed to update sprint' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error updating sprint:', error)
    return NextResponse.json(
      { error: 'Failed to update sprint' },
      { status: 500 }
    )
  }
}
