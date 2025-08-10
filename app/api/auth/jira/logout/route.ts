import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true })
  const cookieOptions = { path: '/' }
  res.cookies.set('JIRA_ACCESS_TOKEN', '', { ...cookieOptions, maxAge: 0 })
  res.cookies.set('JIRA_REFRESH_TOKEN', '', { ...cookieOptions, maxAge: 0 })
  res.cookies.set('JIRA_CLOUD_ID', '', { ...cookieOptions, maxAge: 0 })
  return res
}
