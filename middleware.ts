import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow the login page explicitly
  if (pathname === '/login') {
    // If already authenticated, send to home
    const hasAccessToken = req.cookies.get('JIRA_ACCESS_TOKEN')?.value
    const hasCloudId = req.cookies.get('JIRA_CLOUD_ID')?.value
    if (hasAccessToken && hasCloudId) {
      const url = req.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // For all other matched paths, require auth
  const accessToken = req.cookies.get('JIRA_ACCESS_TOKEN')?.value
  const cloudId = req.cookies.get('JIRA_CLOUD_ID')?.value
  const isAuthenticated = Boolean(accessToken && cloudId)

  if (!isAuthenticated) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('from', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

// Run middleware on all pages except for API routes and static files
export const config = {
  matcher: [
    // Match all paths except the ones starting with:
    // - api (API routes)
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico, robots.txt, sitemap.xml, icons, images and other public assets
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|images|assets|public).*)'
  ]
}
