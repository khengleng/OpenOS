import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export function createSessionClient(request: NextRequest) {
    let response = NextResponse.next({ request })

    const client = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => {
                        request.cookies.set(name, value)
                    })

                    response = NextResponse.next({ request })

                    cookiesToSet.forEach(({ name, value, options }) => {
                        response.cookies.set(name, value, options)
                    })
                },
            },
        }
    )

    return {
        client,
        getResponse: () => response,
    }
}
