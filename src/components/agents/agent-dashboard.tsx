"use client";

import useSWR from "swr";
import { Agent, AgentCard } from "./agent-card";
import { LaunchAgentDialog } from "./launch-agent-dialog";
import { AlertCircle, Loader2 } from "lucide-react";

const API_BASE = "/api/clawwork";

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
        throw new Error(detail || `HTTP ${res.status}`);
    }
    return JSON.parse(payload);
};

export function AgentDashboard() {
    const { data, error, isLoading } = useSWR<{ agents: Agent[] }>(`${API_BASE}/agents`, fetcher, {
        refreshInterval: 5000 // Poll every 5 seconds
    });

    if (error) {
        return (
            <div className="p-4 border border-red-200 bg-red-50 rounded-lg text-red-900 space-y-4">
                <div className="flex items-center gap-2 font-semibold">
                    <AlertCircle className="h-4 w-4" />
                    Error connecting to Agent Network
                </div>
                <p className="text-sm">
                    Could not fetch agents. Ensure the backend is reachable from this app and one of these is configured:
                    `CLAWWORK_INTERNAL_URL` (same Railway project private network) or `NEXT_PUBLIC_CLAWWORK_API_URL`
                    (public ClawWork URL for separate projects).
                </p>
                <p className="text-xs text-red-800 break-all">{String(error.message || "")}</p>
                {/* Still verify we can launch even if list fails (maybe server just started empty?) - unlikely if fetch failed */}
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

    const agents = data?.agents || [];

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <LaunchAgentDialog />
            </div>

            {agents.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-lg bg-muted/20">
                    <h3 className="text-lg font-medium mb-2">No active agents</h3>
                    <p className="text-muted-foreground mb-6 text-center max-w-md">
                        Your workspace is empty. Hire your first AI coworker to start completing tasks.
                    </p>
                    <LaunchAgentDialog />
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {agents.map((agent) => (
                        <AgentCard key={agent.signature} agent={agent} />
                    ))}
                </div>
            )}
        </div>
    );
}
