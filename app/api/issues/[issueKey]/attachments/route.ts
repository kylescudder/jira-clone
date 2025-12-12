import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const JIRA_BASE_URL =
  process.env.JIRA_BASE_URL || 'https://your-domain.atlassian.net'
const JIRA_EMAIL = process.env.JIRA_EMAIL || ''
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || ''

const basicAuth =
  JIRA_EMAIL && JIRA_API_TOKEN
    ? Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')
    : ''

async function getAuthAndBase() {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('JIRA_ACCESS_TOKEN')?.value
    const cloudId = cookieStore.get('JIRA_CLOUD_ID')?.value

    if (accessToken && cloudId) {
      return {
        base: `https://api.atlassian.com/ex/jira/${cloudId}`,
        authorization: `Bearer ${accessToken}`
      }
    }
  } catch (e) {
    // cookies() is only available in server runtime
  }

  return {
    base: JIRA_BASE_URL,
    authorization: basicAuth ? `Basic ${basicAuth}` : ''
  }
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ issueKey: string }> }
) {
  try {
    const { issueKey } = await ctx.params

    // Parse the incoming FormData
    const formData = await request.formData()
    const files = formData.getAll('file') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    const { base, authorization } = await getAuthAndBase()

    if (!authorization) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Build FormData for Jira API
    const jiraFormData = new FormData()
    for (const file of files) {
      jiraFormData.append('file', file, file.name)
    }

    // Upload to Jira
    const response = await fetch(
      `${base}/rest/api/3/issue/${issueKey}/attachments`,
      {
        method: 'POST',
        headers: {
          Authorization: authorization,
          'X-Atlassian-Token': 'no-check'
          // Note: Don't set Content-Type - fetch will set it with boundary for FormData
        },
        body: jiraFormData
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Jira attachment upload failed:', response.status, errorText)
      return NextResponse.json(
        { error: 'Failed to upload attachment', details: errorText },
        { status: response.status }
      )
    }

    // Jira returns array of attachment objects
    const data = await response.json()

    // Map to a cleaner format
    const attachments = (Array.isArray(data) ? data : [data]).map((att: any) => ({
      id: String(att.id),
      filename: att.filename,
      mimeType: att.mimeType,
      size: att.size,
      content: att.content
    }))

    return NextResponse.json(attachments)
  } catch (error) {
    console.error('API Error uploading attachment:', error)
    return NextResponse.json(
      {
        error: 'Failed to upload attachment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
