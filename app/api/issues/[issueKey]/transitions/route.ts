import { NextResponse } from 'next/server'
import { getIssueTransitions } from '@/lib/jira-api'

export async function GET(
  request: Request,
  { params }: { params: { issueKey: string } }
) {
  try {
    const transitions = await getIssueTransitions(params.issueKey)
    return NextResponse.json(transitions)
  } catch (error) {
    console.error('API Error fetching transitions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transitions' },
      { status: 500 }
    )
  }
}
