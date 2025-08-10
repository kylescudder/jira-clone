import { NextResponse } from 'next/server'
import { updateIssueStatus } from '@/lib/jira-api'

export async function PUT(
  request: Request,
  ctx: { params: Promise<{ issueKey: string }> }
) {
  try {
    const body = await request.json()
    const { transitionId } = body

    if (!transitionId) {
      return NextResponse.json(
        { error: 'Transition ID is required' },
        { status: 400 }
      )
    }

    const { issueKey } = await ctx.params

    console.log(`Updating issue ${issueKey} to transition ${transitionId}`)

    const success = await updateIssueStatus(issueKey, transitionId)

    if (success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { error: 'Failed to update status' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('API Error updating status:', error)
    return NextResponse.json(
      {
        error: 'Failed to update status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
