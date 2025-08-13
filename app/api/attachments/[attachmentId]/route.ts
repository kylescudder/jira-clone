import { NextResponse } from 'next/server'
import { jiraFetchStream } from '@/lib/jira-api'

export async function GET(
  request: Request,
  ctx: { params: Promise<{ attachmentId: string }> }
) {
  try {
    const { attachmentId } = await ctx.params

    if (!attachmentId) {
      return NextResponse.json(
        { error: 'Attachment ID is required' },
        { status: 400 }
      )
    }

    const url = new URL(request.url)
    const dispositionParam = url.searchParams.get('disposition') || 'inline'

    const upstream = await jiraFetchStream(
      `/attachment/${attachmentId}/content`
    )

    if (!upstream || !('ok' in upstream) || !(upstream as Response).ok) {
      const status = (upstream as Response)?.status || 502
      return NextResponse.json(
        { error: 'Failed to fetch attachment from Jira' },
        { status }
      )
    }

    const contentType =
      (upstream as Response).headers.get('content-type') ||
      'application/octet-stream'
    const upstreamDisp =
      (upstream as Response).headers.get('content-disposition') || ''
    const filenameMatch =
      /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(upstreamDisp)
    const rawName =
      filenameMatch?.[1] || filenameMatch?.[2] || `${attachmentId}`
    const filename = decodeURIComponent(rawName)

    const headers = new Headers()
    headers.set('Content-Type', contentType)
    headers.set(
      'Content-Disposition',
      `${dispositionParam === 'attachment' ? 'attachment' : 'inline'}; filename="${filename}"`
    )
    // Allow images to render in the page
    headers.set('Cache-Control', 'private, max-age=60')

    return new Response((upstream as Response).body, {
      status: 200,
      headers
    })
  } catch (error) {
    console.error('Attachment proxy error:', error)
    return NextResponse.json(
      {
        error: 'Attachment proxy failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
