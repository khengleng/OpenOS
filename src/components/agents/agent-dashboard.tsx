"use client";

import { useState } from "react";
import useSWR from "swr";
import { Agent, AgentCard } from "./agent-card";
import { LaunchAgentDialog } from "./launch-agent-dialog";
import { AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const API_BASE = "/api/clawwork";
type Simulation = {
    id: string;
    status: string;
    signature?: string;
    start_time?: string;
    end_time?: string;
    model?: string;
    termination_hint?: string;
    stop_reason?: string;
    retry_count?: number;
};
type RunNotification = {
    id: string;
    level: "info" | "warn" | "error" | "success";
    message: string;
    ts: string;
};

const statusBadgeClass = (status: string) => {
    if (status === "running") return "bg-green-100 text-green-800 border-green-200";
    if (status === "completed") return "bg-blue-100 text-blue-800 border-blue-200";
    if (status === "stopped") return "bg-amber-100 text-amber-800 border-amber-200";
    if (status === "terminated") return "bg-red-100 text-red-800 border-red-200";
    return "bg-muted text-muted-foreground";
};

const normalizeStatus = (status?: string) => (status || "unknown").toLowerCase();
const formatWhen = (value?: string) => {
    if (!value) return "n/a";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "n/a";
    return date.toLocaleString();
};

const fetcher = async (url: string) => {
    const res = await fetch(url);
    const payload = await res.text();
    if (!res.ok) {
        let detail = payload;
        try {
            const parsed = JSON.parse(payload) as { error?: string; detail?: string };
            detail = parsed.detail || parsed.error || payload;
        } catch {
            // Best-effort parse only.
        }
        const error = new Error(detail || `HTTP ${res.status}`) as Error & { status?: number };
        error.status = res.status;
        throw error;
    }
    return JSON.parse(payload);
};

export function AgentDashboard() {
    const [authBlocked, setAuthBlocked] = useState(false);
    const { data, error, isLoading } = useSWR<{ agents: Agent[] }>(authBlocked ? null : `${API_BASE}/agents`, fetcher, {
        refreshInterval: authBlocked ? 0 : 5000, // Poll every 5 seconds
        onErrorRetry: (err, _key, _cfg, revalidate, ctx) => {
            const status = (err as { status?: number })?.status;
            if (status === 401 || status === 403) {
                setAuthBlocked(true);
                return;
            }
            if (ctx.retryCount >= 3) return;
            setTimeout(() => revalidate({ retryCount: ctx.retryCount + 1 }), 3000);
        },
        onSuccess: () => setAuthBlocked(false),
    });
    const { data: simulationsData } = useSWR<{ simulations: Simulation[] }>(authBlocked ? null : `${API_BASE}/simulations`, fetcher, {
        refreshInterval: authBlocked ? 0 : 5000, // Poll every 5 seconds
        onErrorRetry: (err, _key, _cfg, revalidate, ctx) => {
            const status = (err as { status?: number })?.status;
            if (status === 401 || status === 403) {
                setAuthBlocked(true);
                return;
            }
            if (ctx.retryCount >= 3) return;
            setTimeout(() => revalidate({ retryCount: ctx.retryCount + 1 }), 3000);
        },
        onSuccess: () => setAuthBlocked(false),
    });
    const agents = data?.agents || [];
    const simulations = [...(simulationsData?.simulations || [])].sort((a, b) => {
        const aTime = new Date(a.start_time || 0).getTime();
        const bTime = new Date(b.start_time || 0).getTime();
        return bTime - aTime;
    });
    const runningSimulations = simulations.filter((sim) => sim.status === "running");

    const completedCount = simulations.filter((sim) => normalizeStatus(sim.status) === "completed").length;
    const stoppedCount = simulations.filter((sim) => normalizeStatus(sim.status) === "stopped").length;
    const terminatedCount = simulations.filter((sim) => normalizeStatus(sim.status) === "terminated").length;
    const existingSimulationIds = new Set(
        agents.map((agent) => agent.simulation_id).filter(Boolean) as string[]
    );
    const simulationAgents: Agent[] = runningSimulations
        .filter((sim) => !existingSimulationIds.has(sim.id))
        .map((sim) => ({
            signature: sim.signature || "agent",
            balance: 0,
            net_worth: 0,
            survival_status: "unknown",
            current_activity: "Starting simulation",
            current_date: sim.start_time,
            total_token_cost: 0,
            is_running: true,
            simulation_id: sim.id,
            model: sim.model,
        }));
    const visibleAgents = [...agents, ...simulationAgents];
    const notifications: RunNotification[] = simulations.slice(0, 8).map((sim) => {
        const status = normalizeStatus(sim.status);
        if (status === "completed") {
            return {
                id: `${sim.id}:completed`,
                level: "success",
                message: `${sim.signature || "Agent"} completed successfully.`,
                ts: sim.end_time || sim.start_time || new Date().toISOString(),
            };
        }
        if (status === "stopped") {
            return {
                id: `${sim.id}:stopped`,
                level: "warn",
                message: sim.stop_reason
                    ? `${sim.signature || "Agent"} stopped: ${sim.stop_reason}`
                    : `${sim.signature || "Agent"} was stopped.`,
                ts: sim.end_time || sim.start_time || new Date().toISOString(),
            };
        }
        if (status === "terminated") {
            return {
                id: `${sim.id}:terminated`,
                level: "error",
                message: sim.termination_hint
                    ? `${sim.signature || "Agent"} failed: ${sim.termination_hint}`
                    : `${sim.signature || "Agent"} terminated unexpectedly.`,
                ts: sim.end_time || sim.start_time || new Date().toISOString(),
            };
        }
        if ((sim.retry_count || 0) > 0) {
            return {
                id: `${sim.id}:restarted`,
                level: "warn",
                message: `${sim.signature || "Agent"} auto-restarted (retry ${sim.retry_count}).`,
                ts: sim.start_time || new Date().toISOString(),
            };
        }
        return {
            id: `${sim.id}:running`,
            level: "info",
            message: `${sim.signature || "Agent"} is running.`,
            ts: sim.start_time || new Date().toISOString(),
        };
    });

    const notifClass = (level: RunNotification["level"]) => {
        if (level === "error") return "border-red-200 bg-red-50 text-red-800";
        if (level === "warn") return "border-amber-200 bg-amber-50 text-amber-800";
        if (level === "success") return "border-green-200 bg-green-50 text-green-800";
        return "border-blue-200 bg-blue-50 text-blue-800";
    };

    if (error) {
        const status = (error as { status?: number })?.status;
        return (
            <div className="p-4 border border-red-200 bg-red-50 rounded-lg text-red-900 space-y-4">
                <div className="flex items-center gap-2 font-semibold">
                    <AlertCircle className="h-4 w-4" />
                    {status === 401 ? "Session Required" : "Error connecting to Agent Network"}
                </div>
                {status === 401 ? (
                    <p className="text-sm">
                        Your session is not authenticated. Sign in again to view and manage AI coworkers.
                    </p>
                ) : (
                    <p className="text-sm">
                        Could not fetch agents. Ensure the backend is reachable from this app and one of these is configured:
                        `CLAWWORK_INTERNAL_URL` (same Railway project private network) or `NEXT_PUBLIC_CLAWWORK_API_URL`
                        (public ClawWork URL for separate projects).
                    </p>
                )}
                <p className="text-xs text-red-800 break-all">{String(error.message || "")}</p>
                <div className="flex gap-2">
                    <LaunchAgentDialog />
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="flex justify-end">
                    <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="flex h-[200px] items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <LaunchAgentDialog />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Agent Records</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">{visibleAgents.length}</CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Running Simulations</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">{runningSimulations.length}</CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Completed</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">{completedCount}</CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Stopped/Failed</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">{stoppedCount + terminatedCount}</CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Run Notifications</CardTitle>
                </CardHeader>
                <CardContent>
                    {notifications.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No recent run events yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {notifications.map((item) => (
                                <div key={item.id} className={`rounded-md border px-3 py-2 text-sm ${notifClass(item.level)}`}>
                                    <div className="font-medium">{item.message}</div>
                                    <div className="text-xs opacity-80">{formatWhen(item.ts)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {visibleAgents.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-lg bg-muted/20">
                    <h3 className="text-lg font-medium mb-2">No active agents</h3>
                    <p className="text-muted-foreground mb-6 text-center max-w-md">
                        No simulations are currently running. Start a new AI coworker to begin work.
                    </p>
                    <LaunchAgentDialog />
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {visibleAgents.map((agent) => (
                        <AgentCard key={agent.simulation_id || agent.signature} agent={agent} />
                    ))}
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Launch Activity</CardTitle>
                </CardHeader>
                <CardContent>
                    {simulations.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No launches yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {simulations.slice(0, 20).map((sim) => {
                                const status = normalizeStatus(sim.status);
                                const shortHint = sim.termination_hint
                                    ? sim.termination_hint.split("\n").slice(-1)[0]
                                    : null;
                                const shortStopReason = sim.stop_reason
                                    ? sim.stop_reason.split("\n").slice(-1)[0]
                                    : null;
                                return (
                                    <div
                                        key={sim.id}
                                        className="grid grid-cols-1 gap-2 rounded-md border p-3 text-sm md:grid-cols-[1fr_auto_auto]"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate font-medium">{sim.signature || "Unnamed Agent"}</p>
                                            <p className="truncate text-xs text-muted-foreground">{sim.id}</p>
                                            {sim.model ? <p className="truncate text-xs text-muted-foreground">{sim.model}</p> : null}
                                            {shortHint ? (
                                                <p className="truncate text-xs text-red-700">
                                                    Exit: {shortHint}
                                                </p>
                                            ) : null}
                                            {shortStopReason ? (
                                                <p className="truncate text-xs text-amber-700">
                                                    Stop: {shortStopReason}
                                                </p>
                                            ) : null}
                                            {typeof sim.retry_count === "number" && sim.retry_count > 0 ? (
                                                <p className="truncate text-xs text-muted-foreground">
                                                    Retries: {sim.retry_count}
                                                </p>
                                            ) : null}
                                        </div>
                                        <div className="flex items-center">
                                            <Badge variant="outline" className={statusBadgeClass(status)}>
                                                {status}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground md:text-right">
                                            {formatWhen(sim.start_time)}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
