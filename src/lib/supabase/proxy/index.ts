
import { NextResponse, type NextRequest } from 'next/server'
import { createLoginRedirect, shouldRedirectToLogin } from './auth-policy'
import { createSessionClient } from './session-client'

export async function updateSession(request: NextRequest) {
    const { client: supabase, getResponse } = createSessionClient(request)

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (shouldRedirectToLogin(request, Boolean(user))) {
        return NextResponse.redirect(createLoginRedirect(request))
    }

    return getResponse()
}
