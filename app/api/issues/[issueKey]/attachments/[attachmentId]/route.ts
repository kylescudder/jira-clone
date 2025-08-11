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
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    }
  } catch {}
  return {
    base: JIRA_BASE_URL,
    headers: basicAuth ? { Authorization: `Basic ${basicAuth}` } : {}
  }
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ issueKey: string; attachmentId: string }> }
) {
  try {
    const { attachmentId } = await ctx.params
    const { base, headers } = await getAuthAndBase()

    // First fetch attachment metadata to obtain the content URL
    const metaRes = await fetch(
      `${base}/rest/api/3/attachment/${attachmentId}`,
      {
        headers: { ...headers, Accept: 'application/json' }
      }
    )
    if (!metaRes.ok) {
      return new NextResponse('Failed to fetch attachment metadata', {
        status: metaRes.status
      })
    }
    const meta = await metaRes.json()
    const contentUrl: string | undefined = meta?.content
    const filename: string = meta?.filename || `attachment-${attachmentId}`
    const mime: string | undefined = meta?.mimeType

    if (!contentUrl) {
      return new NextResponse('Attachment content not available', {
        status: 404
      })
    }

    // Then fetch the binary content using server auth and stream back
    const binRes = await fetch(contentUrl, { headers })
    if (!binRes.ok) {
      return new NextResponse('Failed to fetch attachment content', {
        status: binRes.status
      })
    }

    const disposition =
      new URL(request.url).searchParams.get('disposition') || 'attachment'

    return new NextResponse(binRes.body, {
      status: 200,
      headers: {
        'Content-Type': mime || 'application/octet-stream',
        'Content-Disposition': `${disposition}; filename="${filename.replace(/"/g, '')}"`,
        'Cache-Control': 'private, max-age=60'
      }
    })
  } catch (error) {
    console.error('Attachment proxy error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
