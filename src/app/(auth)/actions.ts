'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type AuthActionState = {
    error: string
}

function mapLoginError(message: string): string {
    const normalized = message.toLowerCase()
    if (normalized.includes('invalid login credentials')) {
        return 'Invalid email or password.'
    }
    if (normalized.includes('email not confirmed')) {
        return 'Please confirm your email before signing in.'
    }
    if (normalized.includes('rate limit')) {
        return 'Too many attempts. Please wait a minute and try again.'
    }
    return message
}

async function getAppBaseUrl() {
    const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
    if (configured) {
        return configured.replace(/\/$/, '')
    }

    const headerStore = await headers()
    const host = headerStore.get('x-forwarded-host') || headerStore.get('host')
    const proto = headerStore.get('x-forwarded-proto') || 'https'
    if (host) {
        return `${proto}://${host}`
    }

    return 'http://localhost:3000'
}

export async function login(prevState: AuthActionState, formData: FormData) {
    const email = String(formData.get('email') || '').trim().toLowerCase()
    const password = String(formData.get('password') || '')

    if (!email || !password) {
        return { error: 'Email and password are required.' }
    }

    try {
        const supabase = await createClient()
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            return { error: mapLoginError(error.message) }
        }
    } catch {
        return { error: 'Login service is unavailable right now. Please try again.' }
    }

    revalidatePath('/', 'layout')
    redirect('/planning')
}

export async function signup(prevState: AuthActionState, formData: FormData) {
    const supabase = await createClient()
    const baseUrl = await getAppBaseUrl()

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const username = formData.get('username') as string

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: `${baseUrl}/auth/confirm?next=/planning`,
            data: {
                username: username || email.split('@')[0],
            }
        }
    })

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/', 'layout')
    if (data.session) {
        redirect('/planning')
    }

    redirect('/login?check_email=1')
}
