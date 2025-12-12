import { NextResponse } from 'next/server'
import { updateIssueDescription } from '@/lib/jira-api'

export async function PUT(
  request: Request,
  ctx: { params: Promise<{ issueKey: string }> }
) {
  try {
    const { issueKey } = await ctx.params
    const { description } = (await request.json()) as {
      description?: string
    }

    if (!issueKey || typeof description !== 'string') {
      return NextResponse.json(
        { error: 'issueKey and description are required' },
        { status: 400 }
      )
    }

    const ok = await updateIssueDescription(issueKey, description)
    if (!ok) {
      return NextResponse.json(
        { error: 'Failed to update description' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error updating description:', error)
    return NextResponse.json(
      { error: 'Failed to update description' },
      { status: 500 }
    )
  }
}
