import { NextResponse } from 'next/server'
import { getIssue } from '@/lib/jira-api'

export async function GET(
  request: Request,
  ctx: { params: Promise<{ issueKey: string }> }
) {
  try {
    const { issueKey } = await ctx.params
    const issue = await getIssue(issueKey)
    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }
    return NextResponse.json(issue)
  } catch (error) {
    console.error('API Error fetching issue:', error)
    return NextResponse.json(
      { error: 'Failed to fetch issue' },
      { status: 500 }
    )
  }
}
