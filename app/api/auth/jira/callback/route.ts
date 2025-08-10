import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 })
  }

  const clientId = process.env.ATLASSIAN_CLIENT_ID
  const clientSecret = process.env.ATLASSIAN_CLIENT_SECRET
  const redirectUri = process.env.ATLASSIAN_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: 'Missing Atlassian OAuth environment variables' },
      { status: 500 }
    )
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri
      })
    })

    if (!tokenRes.ok) {
      const t = await tokenRes.text()
      return NextResponse.json(
        { error: 'Token exchange failed', details: t },
        { status: 500 }
      )
    }

    const tokenJson = await tokenRes.json()
    const accessToken = tokenJson.access_token as string
    const refreshToken = tokenJson.refresh_token as string | undefined
    const expiresIn = tokenJson.expires_in as number | undefined

    // Fetch accessible resources to determine cloudId
    const resourcesRes = await fetch(
      'https://api.atlassian.com/oauth/token/accessible-resources',
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    )

    if (!resourcesRes.ok) {
      const t = await resourcesRes.text()
      return NextResponse.json(
        { error: 'Failed to fetch accessible resources', details: t },
        { status: 500 }
      )
    }

    const resources = (await resourcesRes.json()) as Array<{
      id: string
      name: string
      url: string
      scopes: string[]
    }>
    if (!Array.isArray(resources) || resources.length === 0) {
      return NextResponse.json(
        { error: 'No accessible Jira resources found for this account' },
        { status: 400 }
      )
    }

    // For simplicity, select the first accessible Jira site.
    const cloudId = resources[0].id

    // Set HTTP-only cookies
    const res = NextResponse.redirect(new URL('/', req.url))
    const cookieOptions = {
      httpOnly: true as const,
      sameSite: 'lax' as const,
      secure: true as const,
      path: '/'
    }

    res.cookies.set('JIRA_ACCESS_TOKEN', accessToken, {
      ...cookieOptions,
      maxAge: expiresIn ?? 3600
    })

    if (refreshToken) {
      // store refresh token if present
      res.cookies.set('JIRA_REFRESH_TOKEN', refreshToken, {
        ...cookieOptions,
        maxAge: 60 * 60 * 24 * 30
      })
    }

    res.cookies.set('JIRA_CLOUD_ID', cloudId, {
      ...cookieOptions,
      maxAge: 60 * 60 * 24 * 7
    })

    return res
  } catch (err) {
    console.error('Jira OAuth callback error', err)
    return NextResponse.json(
      { error: 'OAuth callback failed' },
      { status: 500 }
    )
  }
}
