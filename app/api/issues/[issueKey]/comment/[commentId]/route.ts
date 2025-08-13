import { NextResponse } from 'next/server'
import { updateIssueComment, deleteIssueComment } from '@/lib/jira-api'

export async function PUT(
  request: Request,
  ctx: { params: Promise<{ issueKey: string; commentId: string }> }
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

    const { issueKey, commentId } = await ctx.params

    const result = await updateIssueComment(issueKey, commentId, text)

    return NextResponse.json({ success: true, comment: result })
  } catch (error) {
    console.error('API Error updating comment:', error)
    return NextResponse.json(
      {
        error: 'Failed to update comment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ issueKey: string; commentId: string }> }
) {
  try {
    const { issueKey, commentId } = await ctx.params

    await deleteIssueComment(issueKey, commentId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error deleting comment:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete comment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
