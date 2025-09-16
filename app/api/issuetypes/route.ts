import { NextResponse } from 'next/server'
import { getIssueTypes } from '@/lib/jira-api'

export async function GET() {
  try {
    const types = await getIssueTypes()
    return NextResponse.json(types)
  } catch (error) {
    console.error('API Error fetching issue types:', error)
    return NextResponse.json(
      { error: 'Failed to fetch issue types' },
      { status: 500 }
    )
  }
}
