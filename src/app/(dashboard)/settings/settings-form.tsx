'use client'

import { useActionState } from 'react'
import useSWR from 'swr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { DEFAULT_WORKSPACE_MODEL, WORKSPACE_MODEL_OPTIONS } from '@/lib/model-options'
import {
    type SettingsActionState,
    updateAccountSettings,
    updateSecuritySettings,
    updateWorkspaceSettings,
} from './actions'

type SettingsFormProps = {
    email: string
    displayName: string
    timezone: string
    defaultModel: string
    agentPollingInterval: number
}

type ModelOption = {
    value: string
    label: string
    provider: string
}

const INITIAL_STATE: SettingsActionState = {
    error: '',
    success: '',
}

function ActionMessage({ error, success }: SettingsActionState) {
    if (error) {
        return <p className="text-sm text-red-600">{error}</p>
    }
    if (success) {
        return <p className="text-sm text-green-600">{success}</p>
    }
    return null
}

export function SettingsForm({
    email,
    displayName,
    timezone,
    defaultModel,
    agentPollingInterval,
}: SettingsFormProps) {
    const [accountState, accountAction, accountPending] = useActionState(updateAccountSettings, INITIAL_STATE)
    const [securityState, securityAction, securityPending] = useActionState(updateSecuritySettings, INITIAL_STATE)
    const [workspaceState, workspaceAction, workspacePending] = useActionState(updateWorkspaceSettings, INITIAL_STATE)
    const { data: modelData } = useSWR<{ models: ModelOption[] }>(
        '/api/models/available',
        async (url: string) => {
            const res = await fetch(url)
            if (!res.ok) return { models: [] }
            return res.json()
        },
    )
    const modelOptions = (modelData?.models && modelData.models.length > 0)
        ? modelData.models
        : WORKSPACE_MODEL_OPTIONS

    const openaiModels = modelOptions.filter((model) => model.provider === 'OpenAI')
    const anthropicModels = modelOptions.filter((model) => model.provider === 'Anthropic')
    const otherModels = modelOptions.filter((model) => model.provider !== 'OpenAI' && model.provider !== 'Anthropic')
    const selectedModel = modelOptions.some((model) => model.value === defaultModel)
        ? defaultModel
        : DEFAULT_WORKSPACE_MODEL

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Account</CardTitle>
                    <CardDescription>Manage your identity and profile preferences.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={accountAction} className="space-y-4 max-w-xl">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" value={email} disabled />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="display_name">Display name</Label>
                            <Input
                                id="display_name"
                                name="display_name"
                                defaultValue={displayName}
                                minLength={2}
                                maxLength={80}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="timezone">Timezone</Label>
                            <Input id="timezone" name="timezone" defaultValue={timezone} required />
                        </div>
                        <ActionMessage {...accountState} />
                        <Button type="submit" disabled={accountPending}>
                            {accountPending ? 'Saving...' : 'Save account settings'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Security</CardTitle>
                    <CardDescription>Update credentials and protect account access.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={securityAction} className="space-y-4 max-w-xl">
                        <div className="space-y-2">
                            <Label htmlFor="new_password">New password</Label>
                            <Input id="new_password" name="new_password" type="password" minLength={8} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm_password">Confirm new password</Label>
                            <Input id="confirm_password" name="confirm_password" type="password" minLength={8} required />
                        </div>
                        <ActionMessage {...securityState} />
                        <Button type="submit" disabled={securityPending}>
                            {securityPending ? 'Updating...' : 'Update password'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Workspace</CardTitle>
                    <CardDescription>Set your default ClawWork behavior for this account.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={workspaceAction} className="space-y-4 max-w-xl">
                        <div className="space-y-2">
                            <Label htmlFor="default_model">Default agent model</Label>
                            <select
                                id="default_model"
                                name="default_model"
                                defaultValue={selectedModel}
                                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                required
                            >
                                {openaiModels.length > 0 ? (
                                    <optgroup label="OpenAI">
                                        {openaiModels.map((model) => (
                                            <option key={model.value} value={model.value}>
                                                {model.label}
                                            </option>
                                        ))}
                                    </optgroup>
                                ) : null}
                                {anthropicModels.length > 0 ? (
                                    <optgroup label="Anthropic">
                                        {anthropicModels.map((model) => (
                                            <option key={model.value} value={model.value}>
                                                {model.label}
                                            </option>
                                        ))}
                                    </optgroup>
                                ) : null}
                                {otherModels.length > 0 ? (
                                    <optgroup label="Other">
                                        {otherModels.map((model) => (
                                            <option key={model.value} value={model.value}>
                                                {model.label}
                                            </option>
                                        ))}
                                    </optgroup>
                                ) : null}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="agent_polling_interval">Agent refresh interval (seconds)</Label>
                            <Input
                                id="agent_polling_interval"
                                name="agent_polling_interval"
                                type="number"
                                min={2}
                                max={60}
                                defaultValue={String(agentPollingInterval)}
                                required
                            />
                        </div>
                        <ActionMessage {...workspaceState} />
                        <Button type="submit" disabled={workspacePending}>
                            {workspacePending ? 'Saving...' : 'Save workspace settings'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
