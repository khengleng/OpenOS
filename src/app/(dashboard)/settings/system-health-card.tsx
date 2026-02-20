'use client'

import useSWR from 'swr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type HealthResponse = {
    status: string
    service: string
    ts: string
}

type ReadinessResponse = {
    service: string
    ready: boolean
    missing_env: string[]
    clawwork?: { ok?: boolean; status?: number; endpoint?: string; error?: string }
    database?: { ok?: boolean; error?: string; checks?: Array<{ table: string; exists: boolean; error?: string }> }
    ts: string
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

export function SystemHealthCard() {
    const health = useSWR<HealthResponse>('/api/health', fetcher, { refreshInterval: 15000 })
    const readiness = useSWR<ReadinessResponse>('/api/readiness', fetcher, { refreshInterval: 15000 })
    const ready = readiness.data?.ready ?? false

    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between">
                <div className="space-y-1">
                    <CardTitle>System Health</CardTitle>
                    <CardDescription>Live status for app, ClawWork, and deployment prerequisites.</CardDescription>
                </div>
                <Badge variant={ready ? 'default' : 'destructive'}>
                    {ready ? 'Ready' : 'Not Ready'}
                </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">OpenOS API</p>
                        <p className="text-sm font-medium">{health.data?.status || (health.isLoading ? 'Checking...' : 'Unknown')}</p>
                    </div>
                    <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">ClawWork</p>
                        <p className="text-sm font-medium">
                            {readiness.data?.clawwork?.ok ? 'Reachable' : 'Unavailable'}
                        </p>
                    </div>
                    <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Database Checks</p>
                        <p className="text-sm font-medium">
                            {readiness.data?.database ? (readiness.data.database.ok ? 'OK' : 'Attention') : 'N/A'}
                        </p>
                    </div>
                </div>

                {readiness.data?.missing_env?.length ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                        Missing environment values: {readiness.data.missing_env.join(', ')}
                    </div>
                ) : null}

                {readiness.data?.database?.checks?.length ? (
                    <div className="rounded-md border p-3 text-xs space-y-1">
                        <p className="font-medium">Migration checks</p>
                        {readiness.data.database.checks.map((check) => (
                            <p key={check.table} className="text-muted-foreground">
                                {check.table}: {check.exists ? 'ok' : `missing (${check.error || 'unknown'})`}
                            </p>
                        ))}
                    </div>
                ) : null}

                {(health.error || readiness.error) ? (
                    <p className="text-xs text-rose-700">
                        {String(health.error?.message || readiness.error?.message || 'Health check failed')}
                    </p>
                ) : null}

                <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => { void health.mutate(); void readiness.mutate() }}>
                        Refresh now
                    </Button>
                    <p className="text-xs text-muted-foreground">
                        Last readiness update: {readiness.data?.ts ? new Date(readiness.data.ts).toLocaleString() : 'Never'}
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}

