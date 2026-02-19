"use client";

import useSWR from "swr";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";

type OnboardingStatusProps = {
    displayName: string;
    timezone: string;
};

type ReadinessResponse = {
    ready: boolean;
    missing_env?: string[];
    clawwork?: { ok?: boolean; status?: number };
};

type SimulationsResponse = {
    simulations: Array<{ id: string; status?: string }>;
};

const fetcher = async <T,>(url: string): Promise<T> => {
    const res = await fetch(url);
    const payload = await res.text();
    if (!res.ok) {
        throw new Error(payload || `HTTP ${res.status}`);
    }
    return JSON.parse(payload) as T;
};

function Row({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
    return (
        <div className="flex items-start justify-between gap-4 rounded-md border p-3">
            <div className="space-y-1">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{detail}</p>
            </div>
            {ok ? (
                <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    Ready
                </Badge>
            ) : (
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                    <CircleAlert className="mr-1 h-3.5 w-3.5" />
                    Action Needed
                </Badge>
            )}
        </div>
    );
}

export function OnboardingStatus({ displayName, timezone }: OnboardingStatusProps) {
    const {
        data: readiness,
        isLoading: readinessLoading,
        error: readinessError,
    } = useSWR<ReadinessResponse>("/api/readiness", fetcher, { refreshInterval: 15000 });
    const {
        data: simulations,
        isLoading: simulationsLoading,
    } = useSWR<SimulationsResponse>("/api/clawwork/simulations", fetcher, { refreshInterval: 15000 });

    const profileReady = displayName.trim().length >= 2 && timezone.trim().length >= 2;
    const openosReady = Boolean(readiness?.ready);
    const clawworkReady = Boolean(readiness?.clawwork?.ok);
    const hasRun = Boolean((simulations?.simulations || []).length > 0);

    const checks = [
        {
            label: "Account profile",
            ok: profileReady,
            detail: profileReady
                ? "Display name and timezone are configured."
                : "Set display name and timezone below.",
        },
        {
            label: "OpenOS service health",
            ok: openosReady,
            detail: openosReady
                ? "OpenOS reports ready."
                : `Readiness check failing${readiness?.missing_env?.length ? ` (missing: ${readiness.missing_env.join(", ")})` : "."}`,
        },
        {
            label: "ClawWork connection",
            ok: clawworkReady,
            detail: clawworkReady
                ? "ClawWork upstream reachable."
                : `ClawWork not ready${readiness?.clawwork?.status ? ` (status ${readiness.clawwork.status})` : "."}`,
        },
        {
            label: "First coworker launch",
            ok: hasRun,
            detail: hasRun
                ? "At least one simulation record exists."
                : "Launch your first AI coworker from the Agents page.",
        },
    ];

    const completeCount = checks.filter((c) => c.ok).length;
    const allReady = completeCount === checks.length;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <CardTitle>Platform Onboarding</CardTitle>
                        <CardDescription>
                            Track deployment readiness and core setup progress.
                        </CardDescription>
                    </div>
                    <Badge variant={allReady ? "default" : "secondary"}>
                        {completeCount}/{checks.length} complete
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {(readinessLoading || simulationsLoading) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Checking platform status...
                    </div>
                )}
                {readinessError ? (
                    <p className="text-sm text-amber-700">
                        Unable to load readiness endpoint. Ensure you are signed in and the API is reachable.
                    </p>
                ) : null}
                {checks.map((check) => (
                    <Row key={check.label} label={check.label} ok={check.ok} detail={check.detail} />
                ))}
                <div className="flex flex-wrap gap-2 pt-1">
                    <Button asChild size="sm" variant="outline">
                        <Link href="/agents">Open AI Coworkers</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                        <Link href="/community">Open The Mesh</Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
