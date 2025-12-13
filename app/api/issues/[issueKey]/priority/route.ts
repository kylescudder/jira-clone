import { NextResponse } from 'next/server'
import { updateIssuePriority } from '@/lib/jira-api'

export async function PUT(
  request: Request,
  ctx: { params: Promise<{ issueKey: string }> }
) {
  try {
    const { issueKey } = await ctx.params
    const body = await request.json()
    const priority = body?.priority

    if (!priority || typeof priority !== 'string') {
      return NextResponse.json(
        { error: 'priority is required' },
        { status: 400 }
      )
    }

    const ok = await updateIssuePriority(issueKey, priority)
    if (!ok) {
      return NextResponse.json(
        { error: 'Failed to update priority' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API error updating priority:', error)
    return NextResponse.json(
      { error: 'Failed to update priority' },
      { status: 500 }
    )
  }
}
