import { NextResponse } from 'next/server'
import { createIssueComment } from '@/lib/jira-api'

export async function POST(
  request: Request,
  ctx: { params: Promise<{ issueKey: string }> }
) {
  try {
    const body = await request.json().catch(() => ({}))
    const text = (body?.text ?? '').toString().trim()

    if (!text) {
      return NextResponse.json(
        { error: 'Comment text is required' },
        { status: 400 }
      )
    }

    const { issueKey } = await ctx.params

    const result = await createIssueComment(issueKey, text)

    return NextResponse.json({ success: true, comment: result })
  } catch (error) {
    console.error('API Error creating comment:', error)
    return NextResponse.json(
      {
        error: 'Failed to create comment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
