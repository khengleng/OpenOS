import { type EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function buildRedirectUrl(request: NextRequest, pathname: string, params?: Record<string, string>) {
    const url = new URL(pathname, request.nextUrl.origin)
    if (params) {
        Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
    }
    return url
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const next = searchParams.get('next') || '/planning'
    const tokenHash = searchParams.get('token_hash')
    const type = searchParams.get('type') as EmailOtpType | null
    const code = searchParams.get('code')
    const supabase = await createClient()

    if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            return NextResponse.redirect(buildRedirectUrl(request, next))
        }
    }

    if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
            type,
            token_hash: tokenHash,
        })
        if (!error) {
            return NextResponse.redirect(buildRedirectUrl(request, next))
        }
    }

    return NextResponse.redirect(
        buildRedirectUrl(request, '/login', {
            error: 'Email confirmation failed. Please request a new confirmation link.',
        }),
    )
}
