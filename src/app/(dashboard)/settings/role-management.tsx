'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

type AppRole = 'maker' | 'checker' | 'admin'
type MeResponse = {
    role: AppRole | null
    bootstrap_required?: boolean
    can_manage_roles?: boolean
    setup_required?: boolean
    message?: string
}

type RoleAssignment = {
    user_id: string
    role: AppRole
    updated_at: string
}

const fetcher = async <T,>(url: string): Promise<T> => {
    const res = await fetch(url)
    const txt = await res.text()
    if (!res.ok) {
        try {
            const payload = JSON.parse(txt) as Record<string, unknown>
            throw new Error(String(payload.error || payload.detail || txt || `HTTP ${res.status}`))
        } catch {
            throw new Error(txt || `HTTP ${res.status}`)
        }
    }
    return JSON.parse(txt) as T
}

export function RoleManagement() {
    const { data: me, error: meError, mutate: mutateMe } = useSWR<MeResponse>('/api/rbac/me', fetcher)
    const isAdmin = me?.role === 'admin'
    const { data, mutate, isLoading } = useSWR<{ assignments: RoleAssignment[] }>(
        isAdmin ? '/api/rbac/users' : null,
        fetcher,
    )

    const [targetUserId, setTargetUserId] = useState('')
    const [targetRole, setTargetRole] = useState<AppRole>('maker')
    const [draftRoles, setDraftRoles] = useState<Record<string, AppRole>>({})
    const [message, setMessage] = useState('')
    const [busyUserId, setBusyUserId] = useState<string | null>(null)
    const [bootstrapping, setBootstrapping] = useState(false)

    const assignments = data?.assignments || []
    const sortedAssignments = useMemo(
        () => [...assignments].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
        [assignments],
    )

    async function saveRole(userId: string, role: AppRole) {
        setBusyUserId(userId)
        setMessage('')
        try {
            const res = await fetch(`/api/rbac/users/${encodeURIComponent(userId)}`, {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ role }),
            })
            const txt = await res.text()
            if (!res.ok) throw new Error(txt || 'Failed to update role')
            await mutate()
            setMessage(`Role updated for ${userId}`)
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Failed to update role')
        } finally {
            setBusyUserId(null)
        }
    }

    async function bootstrapAdminRole() {
        setBootstrapping(true)
        setMessage('')
        try {
            const res = await fetch('/api/rbac/bootstrap', { method: 'POST' })
            const txt = await res.text()
            if (!res.ok) {
                try {
                    const payload = JSON.parse(txt) as Record<string, unknown>
                    throw new Error(String(payload.error || payload.detail || txt || 'Failed to bootstrap admin role'))
                } catch {
                    throw new Error(txt || 'Failed to bootstrap admin role')
                }
            }
            await mutateMe()
            await mutate()
            setMessage('RBAC initialized. You are now admin.')
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Failed to bootstrap admin role')
        } finally {
            setBootstrapping(false)
        }
    }

    if (meError) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Role Management</CardTitle>
                    <CardDescription>Maker-checker-admin role assignments for this workspace.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">Unable to load role information.</p>
                </CardContent>
            </Card>
        )
    }

    if (me?.setup_required) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Role Management</CardTitle>
                    <CardDescription>Maker-checker-admin role assignments for this workspace.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        {me.message || 'RBAC schema is missing in this deployment.'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Run the latest Supabase migrations, then refresh this page.
                    </p>
                </CardContent>
            </Card>
        )
    }

    if (me?.bootstrap_required) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Role Management</CardTitle>
                    <CardDescription>Maker-checker-admin role assignments for this workspace.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        RBAC is not initialized yet. Claim the first admin role for this workspace.
                    </p>
                    <Button onClick={bootstrapAdminRole} disabled={bootstrapping}>
                        {bootstrapping ? 'Initializing...' : 'Claim Admin Role'}
                    </Button>
                    {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
                </CardContent>
            </Card>
        )
    }

    if (!isAdmin) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Role Management</CardTitle>
                    <CardDescription>Maker-checker-admin role assignments for this workspace.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Admin role is required to view or change user roles.
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Role Management</CardTitle>
                <CardDescription>Assign and update maker/checker/admin roles.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-2 max-w-xl">
                    <Label htmlFor="role_user_id">User ID</Label>
                    <Input
                        id="role_user_id"
                        value={targetUserId}
                        onChange={(e) => setTargetUserId(e.target.value)}
                        placeholder="Supabase user UUID"
                    />
                    <Label htmlFor="role_value">Role</Label>
                    <select
                        id="role_value"
                        value={targetRole}
                        onChange={(e) => setTargetRole(e.target.value as AppRole)}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                        <option value="maker">maker</option>
                        <option value="checker">checker</option>
                        <option value="admin">admin</option>
                    </select>
                    <Button
                        className="w-fit"
                        disabled={!targetUserId.trim() || busyUserId === '__new__'}
                        onClick={() => saveRole(targetUserId.trim(), targetRole)}
                    >
                        Assign Role
                    </Button>
                </div>

                {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

                {isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading assignments...</p>
                ) : (
                    <div className="space-y-2">
                        {sortedAssignments.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No role assignments found.</p>
                        ) : (
                            sortedAssignments.map((entry) => {
                                const currentDraft = draftRoles[entry.user_id] || entry.role
                                return (
                                    <div key={entry.user_id} className="rounded-md border p-3 space-y-2">
                                        <p className="text-sm font-medium">{entry.user_id}</p>
                                        <p className="text-xs text-muted-foreground">
                                            Updated {new Date(entry.updated_at).toLocaleString()}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={currentDraft}
                                                onChange={(e) =>
                                                    setDraftRoles((prev) => ({
                                                        ...prev,
                                                        [entry.user_id]: e.target.value as AppRole,
                                                    }))
                                                }
                                                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                                            >
                                                <option value="maker">maker</option>
                                                <option value="checker">checker</option>
                                                <option value="admin">admin</option>
                                            </select>
                                            <Button
                                                size="sm"
                                                disabled={busyUserId === entry.user_id}
                                                onClick={() => saveRole(entry.user_id, currentDraft)}
                                            >
                                                {busyUserId === entry.user_id ? 'Saving...' : 'Save'}
                                            </Button>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
