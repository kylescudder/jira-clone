import { NextResponse } from 'next/server'
import { getProjectUsers } from '@/lib/jira-api'

export async function GET(
  request: Request,
  { params }: { params: { projectKey: string } }
) {
  try {
    const users = await getProjectUsers(params.projectKey)
    return NextResponse.json(users)
  } catch (error) {
    console.error('API Error fetching project users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch project users' },
      { status: 500 }
    )
  }
}
