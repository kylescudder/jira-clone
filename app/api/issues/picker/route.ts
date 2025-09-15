import { NextResponse } from 'next/server'
import { getIssueSuggestions } from '@/lib/jira-api'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const projectKey = searchParams.get('project') || ''
    const query = searchParams.get('query') || ''

    if (!projectKey) {
      return NextResponse.json(
        { error: 'Project key is required' },
        { status: 400 }
      )
    }

    if (!query || query.trim().length < 6) {
      return NextResponse.json([])
    }

    const suggestions = await getIssueSuggestions(projectKey, query, 20)
    return NextResponse.json(suggestions)
  } catch (error) {
    console.error('API Error fetching issue suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch suggestions' },
      { status: 500 }
    )
  }
}
