'use client'

import { Activity, Copy, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react'
import useSWR from 'swr'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type AppleHealthStatus = {
    connected: boolean
    connection: {
        key_last4?: string | null
        enabled: boolean
        last_sync_at?: string | null
    } | null
    today: {
        metric_date: string
        steps: number
        active_calories?: number | null
        resting_heart_rate?: number | null
        sleep_hours?: number | null
    } | null
    metrics: Array<{
        metric_date: string
        steps: number
        active_calories?: number | null
        resting_heart_rate?: number | null
        sleep_hours?: number | null
    }>
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

export function AppleHealthSyncCard() {
    const { data, error, mutate, isLoading } = useSWR<AppleHealthStatus>('/api/health/apple', fetcher, {
        refreshInterval: 15000,
    })
    const [syncKey, setSyncKey] = useState('')
    const [busy, setBusy] = useState<'rotate' | 'disable' | null>(null)
    const [message, setMessage] = useState('')

    const today = data?.today

    async function rotateKey() {
        setBusy('rotate')
        setMessage('')
        try {
            const res = await fetch('/api/health/apple', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ action: 'rotate_key' }),
            })
            const txt = await res.text()
            if (!res.ok) {
                try {
                    const payload = JSON.parse(txt) as Record<string, unknown>
                    throw new Error(String(payload.error || payload.detail || txt || 'Failed to rotate sync key'))
                } catch {
                    throw new Error(txt || 'Failed to rotate sync key')
                }
            }
            const payload = JSON.parse(txt) as { sync_key?: string; message?: string }
            setSyncKey(payload.sync_key || '')
            setMessage(payload.message || 'Sync key rotated.')
            await mutate()
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Failed to rotate sync key')
        } finally {
            setBusy(null)
        }
    }

    async function disableSync() {
        setBusy('disable')
        setMessage('')
        try {
            const res = await fetch('/api/health/apple', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ action: 'disable' }),
            })
            const txt = await res.text()
            if (!res.ok) {
                try {
                    const payload = JSON.parse(txt) as Record<string, unknown>
                    throw new Error(String(payload.error || payload.detail || txt || 'Failed to disable sync'))
                } catch {
                    throw new Error(txt || 'Failed to disable sync')
                }
            }
            setSyncKey('')
            setMessage('Apple Health sync disabled.')
            await mutate()
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Failed to disable sync')
        } finally {
            setBusy(null)
        }
    }

    async function copySyncKey() {
        if (!syncKey) return
        await navigator.clipboard.writeText(syncKey)
        setMessage('Sync key copied.')
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between">
                <div className="space-y-1">
                    <CardTitle>Apple Health Sync</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Secure iPhone data sync for this account.
                    </p>
                </div>
                <Badge variant={data?.connected ? 'default' : 'secondary'}>
                    {data?.connected ? 'Connected' : 'Not Connected'}
                </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
                {error ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        {String(error.message || 'Unable to load Apple Health status.')}
                    </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Today Steps</p>
                        <p className="text-lg font-semibold">{today?.steps?.toLocaleString() || '0'}</p>
                    </div>
                    <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Active Calories</p>
                        <p className="text-lg font-semibold">{today?.active_calories ?? 0}</p>
                    </div>
                    <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Resting Heart Rate</p>
                        <p className="text-lg font-semibold">{today?.resting_heart_rate ?? 0}</p>
                    </div>
                    <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Sleep Hours</p>
                        <p className="text-lg font-semibold">{today?.sleep_hours ?? 0}</p>
                    </div>
                </div>

                <div className="rounded-md border p-3 text-xs text-muted-foreground space-y-1">
                    <p>
                        Last sync: {data?.connection?.last_sync_at ? new Date(data.connection.last_sync_at).toLocaleString() : 'Never'}
                    </p>
                    <p>Sync key: {data?.connection?.key_last4 ? `••••${data.connection.key_last4}` : 'Not generated yet'}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={rotateKey} disabled={busy === 'rotate' || isLoading}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        {busy === 'rotate' ? 'Rotating...' : 'Generate / Rotate Sync Key'}
                    </Button>
                    <Button variant="outline" onClick={disableSync} disabled={busy === 'disable' || !data?.connected}>
                        {busy === 'disable' ? 'Disabling...' : 'Disable Sync'}
                    </Button>
                    {syncKey ? (
                        <Button variant="secondary" onClick={copySyncKey}>
                            <Copy className="mr-2 h-4 w-4" />Copy New Key
                        </Button>
                    ) : null}
                </div>

                {syncKey ? (
                    <div className="rounded-md border border-green-200 bg-green-50 p-3 text-xs text-green-900">
                        <p className="font-medium">New sync key (shown once)</p>
                        <p className="break-all mt-1">{syncKey}</p>
                    </div>
                ) : null}

                <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground space-y-2">
                    <p className="font-medium text-foreground flex items-center gap-2"><Smartphone className="h-3.5 w-3.5" /> iPhone setup (real signed sync)</p>
                    <p>1) Generate sync key above.</p>
                    <p>2) In your iPhone app/Shortcut, POST JSON to <code>/api/health/apple/sync</code>.</p>
                    <p>3) Send headers:</p>
                    <p><code>x-apple-sync-key</code>, <code>x-apple-sync-ts</code> (epoch ms), <code>x-apple-sync-signature</code> (HMAC-SHA256 hex of <code>{`<ts>.<raw_json>`}</code> using sync key).</p>
                    <p>4) Payload supports <code>metrics[]</code> or single metric with <code>date</code>, <code>steps</code>, <code>active_calories</code>, <code>resting_heart_rate</code>, <code>sleep_hours</code>.</p>
                    <p className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Sync key is hashed server-side and request signatures are verified.</p>
                    <p className="flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> Data is linked to your logged-in account and shown here after sync.</p>
                </div>

                {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
            </CardContent>
        </Card>
    )
}
