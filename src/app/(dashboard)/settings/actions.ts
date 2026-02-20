'use server'

import { createClient } from '@/lib/supabase/server'
import { DEFAULT_WORKSPACE_MODEL } from '@/lib/model-options'

export type SettingsActionState = {
    error: string
    success: string
}

function ok(message: string): SettingsActionState {
    return { error: '', success: message }
}

function fail(message: string): SettingsActionState {
    return { error: message, success: '' }
}

export async function updateAccountSettings(
    prevState: SettingsActionState,
    formData: FormData,
): Promise<SettingsActionState> {
    void prevState

    const displayName = String(formData.get('display_name') || '').trim()
    const timezone = String(formData.get('timezone') || 'UTC').trim()

    if (displayName.length < 2) {
        return fail('Display name must be at least 2 characters.')
    }
    if (timezone.length < 2) {
        return fail('Timezone is required.')
    }

    const supabase = await createClient()
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
        return fail('Unable to load account. Please sign in again.')
    }

    const metadata = (user.user_metadata || {}) as Record<string, unknown>
    const { error } = await supabase.auth.updateUser({
        data: {
            ...metadata,
            display_name: displayName,
            full_name: displayName,
            timezone,
        },
    })

    if (error) {
        return fail(error.message)
    }

    return ok('Account settings updated.')
}

export async function updateSecuritySettings(
    prevState: SettingsActionState,
    formData: FormData,
): Promise<SettingsActionState> {
    void prevState

    const newPassword = String(formData.get('new_password') || '')
    const confirmPassword = String(formData.get('confirm_password') || '')

    if (newPassword.length < 8) {
        return fail('Password must be at least 8 characters.')
    }
    if (newPassword !== confirmPassword) {
        return fail('Passwords do not match.')
    }

    const supabase = await createClient()
    const { error } = await supabase.auth.updateUser({
        password: newPassword,
    })

    if (error) {
        return fail(error.message)
    }

    return ok('Password updated.')
}

export async function updateWorkspaceSettings(
    prevState: SettingsActionState,
    formData: FormData,
): Promise<SettingsActionState> {
    void prevState

    const defaultModel = String(formData.get('default_model') || '').trim()
    const pollingIntervalRaw = String(formData.get('agent_polling_interval') || '5').trim()
    const pollingInterval = Number(pollingIntervalRaw)

    if (!defaultModel) {
        return fail('Default model is required.')
    }
    if (defaultModel.length > 120) {
        return fail('Default model is invalid.')
    }
    if (!Number.isFinite(pollingInterval) || pollingInterval < 2 || pollingInterval > 60) {
        return fail('Agent refresh interval must be between 2 and 60 seconds.')
    }

    const supabase = await createClient()
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
        return fail('Unable to load workspace. Please sign in again.')
    }

    const metadata = (user.user_metadata || {}) as Record<string, unknown>
    const { error } = await supabase.auth.updateUser({
        data: {
            ...metadata,
            workspace_default_model: defaultModel || DEFAULT_WORKSPACE_MODEL,
            workspace_agent_polling_interval: pollingInterval,
        },
    })

    if (error) {
        return fail(error.message)
    }

    return ok('Workspace settings updated.')
}
