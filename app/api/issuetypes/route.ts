import { NextResponse } from 'next/server'
import { getIssueTypes } from '@/lib/jira-api'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const projectKey = searchParams.get('project') || undefined
    const types = await getIssueTypes(projectKey || undefined)
    return NextResponse.json(types)
  } catch (error) {
    console.error('API Error fetching issue types:', error)
    return NextResponse.json(
      { error: 'Failed to fetch issue types' },
      { status: 500 }
    )
  }
}
