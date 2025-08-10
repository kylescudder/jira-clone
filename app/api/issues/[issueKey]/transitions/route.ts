import { NextResponse } from 'next/server'
import { getIssueTransitions } from '@/lib/jira-api'

export async function GET(
  request: Request,
  ctx: { params: Promise<{ issueKey: string }> }
) {
  try {
    const { issueKey } = await ctx.params
    const transitions = await getIssueTransitions(issueKey)
    return NextResponse.json(transitions)
  } catch (error) {
    console.error('API Error fetching transitions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transitions' },
      { status: 500 }
    )
  }
}
