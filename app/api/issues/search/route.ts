import { NextResponse } from 'next/server'
import { searchIssuesByText } from '@/lib/jira-api'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const projectKey = searchParams.get('project') || ''
    const query = searchParams.get('query') || ''

    const trimmed = query.trim()
    if (!trimmed) {
      return NextResponse.json([])
    }

    const results = await searchIssuesByText(projectKey, trimmed, 25)
    return NextResponse.json(results)
  } catch (error) {
    console.error('API Error performing global issue search:', error)
    return NextResponse.json(
      { error: 'Failed to search issues' },
      { status: 500 }
    )
  }
}
