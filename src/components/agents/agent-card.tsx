"use client";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, CircleDollarSign, Coins, PowerOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useSWRConfig } from "swr";

const API_URL = process.env.NEXT_PUBLIC_CLAWWORK_API_URL || "https://clawwork-backend-production.up.railway.app";

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
}

interface AgentCardProps {
    agent: Agent;
}

export function AgentCard({ agent }: AgentCardProps) {
    const isThriving = agent.survival_status === "thriving";
    const [stopping, setStopping] = useState(false);
    const { mutate } = useSWRConfig();

    const handleStop = async () => {
        if (!agent.simulation_id) return;
        setStopping(true);
        try {
            const response = await fetch(`${API_URL}/api/simulations/${agent.simulation_id}/stop`, {
                method: "POST"
            });
            if (response.ok) {
                mutate(`${API_URL}/api/agents`);
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

    return (
        <Card className="hover:shadow-lg transition-shadow relative overflow-hidden">
            {agent.is_running && (
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
                    {agent.is_running && (
                        <Badge variant="outline" className="border-green-500 text-green-500">Live</Badge>
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
                    {agent.current_activity && (
                        <div className="flex items-center gap-4">
                            <Activity className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1 space-y-1">
                                <p className="text-sm font-medium leading-none">Current Activity</p>
                                <p className="text-xs text-muted-foreground">
                                    {agent.current_activity} ({agent.current_date})
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
            <CardFooter className="flex gap-2">
                <Button variant="outline" className="flex-1" disabled>
                    View Details
                </Button>
                {agent.is_running && (
                    <Button variant="destructive" size="icon" onClick={handleStop} disabled={stopping} title="Stop Agent">
                        {stopping ? <Loader2 className="h-4 w-4 animate-spin" /> : <PowerOff className="h-4 w-4" />}
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
}
