import { NextResponse } from 'next/server'
import { updateIssueAssignee } from '@/lib/jira-api'

export async function PUT(
  request: Request,
  ctx: { params: Promise<{ issueKey: string }> }
) {
  try {
    const body = await request.json()
    const { accountId } = body
    const { issueKey } = await ctx.params

    console.log(
      `Updating issue ${issueKey} assignee to ${accountId || 'unassigned'}`
    )

    const success = await updateIssueAssignee(issueKey, accountId)

    if (success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { error: 'Failed to update assignee' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('API Error updating assignee:', error)
    return NextResponse.json(
      {
        error: 'Failed to update assignee',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
