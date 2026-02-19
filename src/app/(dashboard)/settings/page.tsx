import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from './settings-form'
import { OnboardingStatus } from './onboarding-status'

export default async function SettingsPage() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    const metadata = (user?.user_metadata || {}) as Record<string, unknown>
    const displayName = String(metadata.display_name || metadata.full_name || '').trim()
    const timezone = String(metadata.timezone || 'UTC')
    const defaultModel = String(metadata.workspace_default_model || 'gpt-4o')
    const agentPollingInterval = Number(metadata.workspace_agent_polling_interval || 5)

    return (
        <div className="space-y-4">
            <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
            <OnboardingStatus displayName={displayName} timezone={timezone} />
            <SettingsForm
                email={user?.email || ''}
                displayName={displayName}
                timezone={timezone}
                defaultModel={defaultModel}
                agentPollingInterval={Number.isFinite(agentPollingInterval) ? agentPollingInterval : 5}
            />
        </div>
    )
}
