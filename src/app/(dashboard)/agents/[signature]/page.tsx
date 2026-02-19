"use client";

import useSWR from "swr";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2 } from "lucide-react";

type AgentDetails = {
    signature: string;
    current_status: {
        balance: number;
        net_worth: number;
        survival_status: string;
        total_token_cost: number;
        total_work_income: number;
        current_activity?: string;
        current_date?: string;
        avg_evaluation_score?: number | null;
    };
    stats: {
        total_decisions: number;
        total_evaluations: number;
        balance_history_points: number;
    };
};
type SimulationsResponse = {
    simulations: Array<{
        id: string;
        signature?: string;
        status?: string;
        model?: string;
        retry_count?: number;
        termination_hint?: string;
        stop_reason?: string;
        start_time?: string;
        end_time?: string;
    }>;
};

const fetcher = async <T,>(url: string): Promise<T> => {
    const res = await fetch(url);
    const payload = await res.text();
    if (!res.ok) {
        throw new Error(payload || `HTTP ${res.status}`);
    }
    return JSON.parse(payload) as T;
};

export default function AgentDetailsPage() {
    const params = useParams<{ signature: string }>();
    const signature = decodeURIComponent(params.signature);
    const { data, error, isLoading } = useSWR<AgentDetails>(
        `/api/clawwork/agents/${encodeURIComponent(signature)}`,
        fetcher,
        { refreshInterval: 5000 },
    );
    const { data: simData } = useSWR<SimulationsResponse>(
        "/api/clawwork/simulations",
        fetcher,
        { refreshInterval: 5000 },
    );

    if (isLoading) {
        return (
            <div className="flex h-[300px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="space-y-4 p-8">
                <Button asChild variant="outline">
                    <Link href="/agents">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to AI Coworkers
                    </Link>
                </Button>
                <Card>
                    <CardHeader>
                        <CardTitle>Unable to load agent details</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        {String(error?.message || "Unknown error")}
                    </CardContent>
                </Card>
            </div>
        );
    }

    const status = data.current_status;
    const fmtMoney = (value: number) => `$${(Number(value) || 0).toFixed(2)}`;
    const latestSimulation = (simData?.simulations || [])
        .filter((sim) => (sim.signature || "").trim() === data.signature)
        .sort((a, b) => new Date(b.start_time || 0).getTime() - new Date(a.start_time || 0).getTime())[0];

    return (
        <div className="space-y-6 p-8">
            <div className="flex items-center justify-between">
                <Button asChild variant="outline">
                    <Link href="/agents">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to AI Coworkers
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>{data.signature}</CardTitle>
                    <Badge variant="outline">{status.survival_status}</Badge>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm md:grid-cols-2">
                    <p><span className="font-medium">Net Worth:</span> {fmtMoney(status.net_worth)}</p>
                    <p><span className="font-medium">Balance:</span> {fmtMoney(status.balance)}</p>
                    <p><span className="font-medium">Total Cost:</span> {fmtMoney(status.total_token_cost)}</p>
                    <p><span className="font-medium">Work Income:</span> {fmtMoney(status.total_work_income)}</p>
                    <p><span className="font-medium">Current Activity:</span> {status.current_activity || "No active run"}</p>
                    <p><span className="font-medium">Current Date:</span> {status.current_date || "n/a"}</p>
                    <p><span className="font-medium">Avg Evaluation:</span> {status.avg_evaluation_score ?? "n/a"}</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Agent Stats</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm md:grid-cols-3">
                    <p><span className="font-medium">Decisions:</span> {data.stats.total_decisions}</p>
                    <p><span className="font-medium">Evaluations:</span> {data.stats.total_evaluations}</p>
                    <p><span className="font-medium">Balance Points:</span> {data.stats.balance_history_points}</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Latest Simulation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                    {latestSimulation ? (
                        <>
                            <p><span className="font-medium">Simulation ID:</span> {latestSimulation.id}</p>
                            <p><span className="font-medium">Status:</span> {latestSimulation.status || "unknown"}</p>
                            <p><span className="font-medium">Model:</span> {latestSimulation.model || "n/a"}</p>
                            <p><span className="font-medium">Retries:</span> {latestSimulation.retry_count || 0}</p>
                            <p><span className="font-medium">Started:</span> {latestSimulation.start_time || "n/a"}</p>
                            <p><span className="font-medium">Ended:</span> {latestSimulation.end_time || "n/a"}</p>
                            {latestSimulation.stop_reason ? (
                                <p className="text-amber-700">
                                    <span className="font-medium">Stop Reason:</span> {latestSimulation.stop_reason}
                                </p>
                            ) : null}
                            {latestSimulation.termination_hint ? (
                                <p className="text-red-700">
                                    <span className="font-medium">Termination Hint:</span> {latestSimulation.termination_hint}
                                </p>
                            ) : null}
                        </>
                    ) : (
                        <p className="text-muted-foreground">No simulation records found for this agent yet.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
