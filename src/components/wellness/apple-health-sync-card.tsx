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

    function getSyncEndpoint(): string {
        if (typeof window === 'undefined') return '/api/health/apple/sync'
        return `${window.location.origin}/api/health/apple/sync`
    }

    function syncKeyOrPlaceholder(): string {
        if (syncKey) return syncKey
        if (data?.connection?.key_last4) return `ahs_your_full_key_ending_${data.connection.key_last4}`
        return 'ahs_your_sync_key'
    }

    function sampleBodyText(): string {
        return JSON.stringify(
            {
                metrics: [
                    {
                        date: new Date().toISOString().slice(0, 10),
                        steps: 9234,
                        active_calories: 540,
                        resting_heart_rate: 58,
                        sleep_hours: 7.2,
                    },
                ],
            },
            null,
            2,
        )
    }

    function copyHeadersTemplate() {
        const endpoint = getSyncEndpoint()
        const headersTemplate = [
            `POST ${endpoint}`,
            `x-apple-sync-key: ${syncKeyOrPlaceholder()}`,
            'x-apple-sync-ts: <epoch_ms>',
            'x-apple-sync-signature: <hmac_sha256_hex_of_<ts>.<raw_json>>',
            'content-type: application/json',
        ].join('\n')
        navigator.clipboard.writeText(headersTemplate)
            .then(() => setMessage('Header template copied.'))
            .catch(() => setMessage('Failed to copy headers.'))
    }

    function copySamplePayload() {
        navigator.clipboard.writeText(sampleBodyText())
            .then(() => setMessage('Sample JSON payload copied.'))
            .catch(() => setMessage('Failed to copy sample payload.'))
    }

    function copyCurlTemplate() {
        const endpoint = getSyncEndpoint()
        const key = syncKeyOrPlaceholder()
        const curlTemplate = [
            'TS=$(date +%s%3N)',
            `KEY="${key}"`,
            `BODY='${JSON.stringify({ metrics: [{ date: new Date().toISOString().slice(0, 10), steps: 9234 }] })}'`,
            'SIG=$(printf "%s.%s" "$TS" "$BODY" | openssl dgst -sha256 -hmac "$KEY" -hex | sed \'s/^.* //\')',
            `curl -X POST "${endpoint}" \\`,
            '  -H "content-type: application/json" \\',
            '  -H "x-apple-sync-key: $KEY" \\',
            '  -H "x-apple-sync-ts: $TS" \\',
            '  -H "x-apple-sync-signature: $SIG" \\',
            '  -d "$BODY"',
        ].join('\n')
        navigator.clipboard.writeText(curlTemplate)
            .then(() => setMessage('cURL template copied.'))
            .catch(() => setMessage('Failed to copy cURL template.'))
    }

    function downloadShortcutSetup() {
        const endpoint = getSyncEndpoint()
        const content = {
            name: 'OpenOS Apple Health Sync Setup',
            endpoint,
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-apple-sync-key': syncKeyOrPlaceholder(),
                'x-apple-sync-ts': '<epoch_ms>',
                'x-apple-sync-signature': '<hmac_sha256_hex_of_<ts>.<raw_json>>',
            },
            payload_example: JSON.parse(sampleBodyText()),
            shortcuts_steps: [
                '1. Create a Text action with your JSON body.',
                '2. Get current date and convert to epoch milliseconds for x-apple-sync-ts.',
                '3. Compute HMAC-SHA256 over "<ts>.<raw_json>" using sync key.',
                '4. Use Get Contents of URL with POST, headers above, and Text body.',
            ],
        }
        const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'openos-apple-health-shortcut-setup.json'
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        setMessage('Shortcut setup file downloaded.')
    }

    function syncDiagnosticHint(err: string): string {
        const text = err.toLowerCase()
        if (text.includes('unauthorized') || text.includes('invalid apple health sync key')) {
            return 'Session or sync key is invalid. Sign in again and rotate a new sync key.'
        }
        if (text.includes('missing sync signature headers')) {
            return 'Signature headers are missing. Send x-apple-sync-ts and x-apple-sync-signature.'
        }
        if (text.includes('invalid sync request signature')) {
            return 'Signature mismatch. Recompute HMAC using "<ts>.<raw_json>" with the exact raw JSON payload.'
        }
        if (text.includes('apple health schema missing')) {
            return 'Database tables are missing. Run the Apple Health Supabase migration.'
        }
        return 'Check endpoint, auth session, sync key, timestamp, and signature generation.'
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
                    {error ? 'Not Connected' : data?.connected ? 'Connected' : 'Not Connected'}
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
                    <Button variant="outline" onClick={copyHeadersTemplate}>
                        <Copy className="mr-2 h-4 w-4" />Copy Headers
                    </Button>
                    <Button variant="outline" onClick={copySamplePayload}>
                        <Copy className="mr-2 h-4 w-4" />Copy Sample JSON
                    </Button>
                    <Button variant="outline" onClick={copyCurlTemplate}>
                        <Copy className="mr-2 h-4 w-4" />Copy cURL
                    </Button>
                    <Button variant="outline" onClick={downloadShortcutSetup}>
                        <Smartphone className="mr-2 h-4 w-4" />Download iPhone Setup
                    </Button>
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
                    <p>Endpoint: <code>{getSyncEndpoint()}</code></p>
                </div>

                {(error || message) ? (
                    <div className="rounded-md border p-3 text-xs space-y-1">
                        <p className="font-medium">Sync diagnostics</p>
                        {error ? <p className="text-rose-700">Last error: {String(error.message || 'Unknown error')}</p> : null}
                        {error ? <p className="text-muted-foreground">Hint: {syncDiagnosticHint(String(error.message || ''))}</p> : null}
                        {message ? <p className="text-muted-foreground">Last action: {message}</p> : null}
                    </div>
                ) : null}

                {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
            </CardContent>
        </Card>
    )
}
