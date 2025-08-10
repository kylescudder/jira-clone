import { NextResponse } from 'next/server'

export async function GET() {
  const clientId = process.env.ATLASSIAN_CLIENT_ID
  const redirectUri = process.env.ATLASSIAN_REDIRECT_URI
  const scopes =
    process.env.ATLASSIAN_SCOPES ||
    'read:jira-user read:jira-work offline_access'

  if (!clientId || !redirectUri) {
    const missing: string[] = []
    if (!clientId) missing.push('ATLASSIAN_CLIENT_ID')
    if (!redirectUri) missing.push('ATLASSIAN_REDIRECT_URI')
    return NextResponse.json(
      {
        error: 'Missing Atlassian OAuth configuration',
        missing,
        help: 'Set the required environment variables. See README: Jira Authentication setup.'
      },
      { status: 500 }
    )
  }

  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    state: 'secure_random_state',
    response_type: 'code',
    prompt: 'consent'
  })

  const authUrl = `https://auth.atlassian.com/authorize?${params.toString()}`
  return NextResponse.redirect(authUrl)
}
