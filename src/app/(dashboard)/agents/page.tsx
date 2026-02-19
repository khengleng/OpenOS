"use client";

import { AgentDashboard } from "@/components/agents/agent-dashboard";
import { CoworkerTaskBoard } from "@/components/agents/coworker-task-board";

export default function AgentsPage() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">AI Coworkers</h2>
                <div className="flex items-center space-x-2">
                    {/* Additional header actions can go here */}
                </div>
            </div>
            <AgentDashboard />
            <CoworkerTaskBoard />
        </div>
    );
}
