import { NextResponse } from 'next/server'
import { createIssueLink } from '@/lib/jira-api'

export async function POST(
  request: Request,
  { params }: { params: { issueKey: string } }
) {
  try {
    const { issueKey } = params
    const body = await request.json()
    const toIssueKey = String(body?.toIssueKey || '').trim()
    const linkType = String(body?.linkType || 'Relates')

    if (!issueKey || !toIssueKey) {
      return NextResponse.json(
        { error: 'issueKey and toIssueKey are required' },
        { status: 400 }
      )
    }

    const ok = await createIssueLink({
      fromIssueKey: issueKey,
      toIssueKey,
      linkType
    })

    if (!ok) {
      return NextResponse.json(
        { error: 'Failed to create link' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error creating issue link:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
