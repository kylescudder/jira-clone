import { NextResponse } from 'next/server'
import { getProjectComponents } from '@/lib/jira-api'

export async function GET(
  _request: Request,
  context: { params: { projectKey: string } }
) {
  try {
    const projectKey = context.params.projectKey
    if (!projectKey) {
      return NextResponse.json(
        { error: 'Project key is required' },
        { status: 400 }
      )
    }
    const components = await getProjectComponents(projectKey)
    return NextResponse.json(components)
  } catch (error) {
    console.error('API Error fetching components:', error)
    return NextResponse.json(
      { error: 'Failed to fetch project components' },
      { status: 500 }
    )
  }
}
