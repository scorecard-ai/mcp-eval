import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(error)}`, request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', request.url))
  }

  // Store the authorization code temporarily
  // In a real app, you'd exchange this for tokens
  const redirectUrl = new URL('/', request.url)
  redirectUrl.searchParams.set('auth_code', code)
  redirectUrl.searchParams.set('state', state || '')

  return NextResponse.redirect(redirectUrl)
}