import { NextResponse } from 'next/server'
import { getIssueDetails } from '@/lib/jira-api'

export async function GET(
  request: Request,
  ctx: { params: Promise<{ issueKey: string }> }
) {
  try {
    const { issueKey } = await ctx.params
    const details = await getIssueDetails(issueKey)
    return NextResponse.json(details)
  } catch (error) {
    console.error('API Error fetching issue details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch issue details' },
      { status: 500 }
    )
  }
}
