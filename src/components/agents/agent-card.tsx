"use client";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, CircleDollarSign, Coins, PowerOff, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useSWRConfig } from "swr";
import Link from "next/link";

const API_BASE = "/api/clawwork";

export interface Agent {
    signature: string;
    balance: number;
    net_worth: number;
    survival_status: string;
    current_activity?: string;
    current_date?: string;
    total_token_cost: number;
    is_running?: boolean;
    simulation_id?: string;
    model?: string;
}

interface AgentCardProps {
    agent: Agent;
}

export function AgentCard({ agent }: AgentCardProps) {
    const isThriving = agent.survival_status === "thriving";
    const [stopping, setStopping] = useState(false);
    const [restarting, setRestarting] = useState(false);
    const { mutate } = useSWRConfig();
    const isRunning = Boolean(agent.is_running);
    const parsedCurrentDate = agent.current_date ? new Date(agent.current_date) : null;
    const hasValidDate = Boolean(parsedCurrentDate && !Number.isNaN(parsedCurrentDate.getTime()));
    const activityText = agent.current_activity || (isRunning ? "Starting simulation" : "No active run");
    const activityMeta = hasValidDate ? parsedCurrentDate!.toLocaleString() : null;

    const handleStop = async () => {
        if (!agent.simulation_id) return;
        setStopping(true);
        try {
            const response = await fetch(`${API_BASE}/simulations/${agent.simulation_id}/stop`, {
                method: "POST"
            });
            if (response.ok) {
                mutate(`${API_BASE}/agents`);
            } else {
                alert("Failed to stop agent");
            }
        } catch (error) {
            console.error("Error stopping agent:", error);
            alert("Error stopping agent");
        } finally {
            setStopping(false);
        }
    };

    const handleRestart = async () => {
        const signature = agent.signature.replace(/\s\([^)]+\)$/, "");
        if (!signature) return;
        setRestarting(true);
        try {
            const config = {
                livebench: {
                    date_range: {
                        init_date: new Date().toISOString().split("T")[0],
                        end_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
                    },
                    economic: {
                        initial_balance: Math.max(10, Number(agent.balance || 10)),
                        token_pricing: {
                            input_per_1m: 2.5,
                            output_per_1m: 10.0,
                        },
                    },
                    agents: [
                        {
                            signature,
                            basemodel: agent.model || "gpt-4o",
                            enabled: true,
                            tasks_per_day: 1,
                            supports_multimodal: true,
                        },
                    ],
                    agent_params: {
                        max_steps: 20,
                        max_retries: 3,
                        base_delay: 0.5,
                        tasks_per_day: 1,
                    },
                    evaluation: {
                        use_llm_evaluation: true,
                    },
                    data_path: "./livebench/data/agent_data",
                    gdpval_path: "./gdpval",
                },
            };

            const response = await fetch(`${API_BASE}/simulations`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ config }),
            });
            if (!response.ok) {
                const raw = await response.text();
                throw new Error(raw || "Failed to restart agent");
            }
            mutate(`${API_BASE}/agents`);
            mutate(`${API_BASE}/simulations`);
        } catch (error) {
            console.error("Error restarting agent:", error);
            alert("Error restarting agent");
        } finally {
            setRestarting(false);
        }
    };

    return (
        <Card className="hover:shadow-lg transition-shadow relative overflow-hidden">
            {isRunning && (
                <div className="absolute top-0 right-0 p-2">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                </div>
            )}
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                    {agent.signature}
                </CardTitle>
                <div className="flex gap-2">
                    <Badge variant={isThriving ? "default" : "secondary"} className={isThriving ? "bg-green-600 hover:bg-green-700" : ""}>
                        {agent.survival_status}
                    </Badge>
                    {isRunning ? (
                        <Badge variant="outline" className="border-green-500 text-green-500">Live</Badge>
                    ) : (
                        <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">Inactive</Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid gap-4 py-4">
                    <div className="flex items-center gap-4">
                        <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 space-y-1">
                            <p className="text-sm font-medium leading-none">Net Worth</p>
                            <p className="text-2xl font-bold">${agent.net_worth.toFixed(2)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Coins className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 space-y-1">
                            <p className="text-sm font-medium leading-none">Total Cost</p>
                            <p className="text-muted-foreground">${agent.total_token_cost.toFixed(2)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 space-y-1">
                            <p className="text-sm font-medium leading-none">Current Activity</p>
                            <p className="text-xs text-muted-foreground">{activityText}</p>
                            {activityMeta ? <p className="text-xs text-muted-foreground">Updated {activityMeta}</p> : null}
                        </div>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex gap-2">
                <Button asChild variant="outline" className="flex-1">
                    <Link href={`/agents/${encodeURIComponent(agent.signature)}`}>
                    View Details
                    </Link>
                </Button>
                {isRunning ? (
                    <Button variant="destructive" size="icon" onClick={handleStop} disabled={stopping} title="Stop Agent">
                        {stopping ? <Loader2 className="h-4 w-4 animate-spin" /> : <PowerOff className="h-4 w-4" />}
                    </Button>
                ) : (
                    <Button variant="secondary" size="icon" onClick={handleRestart} disabled={restarting} title="Restart Agent">
                        {restarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
}
