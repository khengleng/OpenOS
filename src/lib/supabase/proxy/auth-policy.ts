import { type NextRequest } from 'next/server'

const LOGIN_PATH = '/login'
const REGISTER_PATH = '/register'
const PUBLIC_PATH_PREFIXES = ['/auth', '/manifest', '/sw', '/workbox', '/icon-', '/api/health', '/api/readiness']

export function shouldRedirectToLogin(request: NextRequest, hasUser: boolean): boolean {
    if (hasUser) return false

    const { pathname } = request.nextUrl
    if (pathname === '/' || pathname === LOGIN_PATH || pathname === REGISTER_PATH) return false

    return !PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export function createLoginRedirect(request: NextRequest): URL {
    const url = request.nextUrl.clone()
    url.pathname = LOGIN_PATH
    return url
}
