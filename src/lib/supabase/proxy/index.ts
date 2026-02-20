
import { NextResponse, type NextRequest } from 'next/server'
import { createLoginRedirect, shouldRedirectToLogin } from './auth-policy'
import { createSessionClient } from './session-client'

function hasSupabaseConfig() {
    return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export async function updateSession(request: NextRequest) {
    if (!hasSupabaseConfig()) {
        if (shouldRedirectToLogin(request, false)) {
            return NextResponse.redirect(createLoginRedirect(request))
        }
        return NextResponse.next({ request })
    }

    const { client: supabase, getResponse } = createSessionClient(request)

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    let hasUser = false
    const hasAuthCookie = request.cookies
        .getAll()
        .some((cookie) => cookie.name.includes("-auth-token"))
    try {
        const {
            data: { session },
        } = await supabase.auth.getSession()
        hasUser = Boolean(session?.user)

        const {
            data: { user },
            error,
        } = await supabase.auth.getUser()

        // getUser is authoritative; but on transient failures, keep existing
        // session state instead of force-redirecting to /login.
        if (!error) {
            hasUser = Boolean(user)
        }
    } catch {
        // Avoid logging users out during temporary auth service/network issues.
    }

    // If auth cookies exist, avoid force-redirecting to /login on transient auth checks.
    if (shouldRedirectToLogin(request, hasUser || hasAuthCookie)) {
        return NextResponse.redirect(createLoginRedirect(request))
    }

    return getResponse()
}
