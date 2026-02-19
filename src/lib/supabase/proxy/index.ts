
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

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (shouldRedirectToLogin(request, Boolean(user))) {
        return NextResponse.redirect(createLoginRedirect(request))
    }

    return getResponse()
}
