import { type NextRequest } from 'next/server'

const LOGIN_PATH = '/login'
const REGISTER_PATH = '/register'
const PUBLIC_PATH_PREFIXES = ['/auth', '/manifest', '/sw', '/workbox', '/icon-', '/api/health', '/api/readiness']
const ENFORCE_MIDDLEWARE_AUTH = process.env.ENFORCE_MIDDLEWARE_AUTH === 'true'

export function shouldRedirectToLogin(request: NextRequest, hasUser: boolean): boolean {
    // Default behavior: do not hard-redirect in middleware.
    // This avoids logout loops from transient session/cookie sync issues.
    if (!ENFORCE_MIDDLEWARE_AUTH) return false

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
