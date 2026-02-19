"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useSWRConfig } from "swr";

const API_BASE = "/api/clawwork";
const PROVIDER_MODELS = {
    openai: [
        { label: "GPT-4o", value: "gpt-4o" },
        { label: "GPT-4 Turbo", value: "gpt-4-turbo" },
    ],
    anthropic: [
        { label: "Claude 3.5 Sonnet", value: "anthropic/claude-3.5-sonnet" },
        { label: "Claude 3 Opus", value: "anthropic/claude-3-opus" },
    ],
} as const;
type Provider = keyof typeof PROVIDER_MODELS;

export function LaunchAgentDialog() {
    const suggestAgentName = () => `agent-${Date.now().toString().slice(-6)}`;
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const { mutate } = useSWRConfig();

    // Form state
    const [agentName, setAgentName] = useState(suggestAgentName());
    const [provider, setProvider] = useState<Provider>("openai");
    const [model, setModel] = useState<string>(PROVIDER_MODELS.openai[0].value);
    const [initialBalance, setInitialBalance] = useState("10");


    const handleLaunch = async () => {
        setErrorMessage("");
        setLoading(true);
        try {
            const signature = agentName.trim();
            if (!signature) {
                throw new Error("Agent name is required.");
            }

            const existingRes = await fetch(`${API_BASE}/agents`);
            if (existingRes.ok) {
                const existingJson = await existingRes.json() as { agents?: Array<{ signature?: string }> };
                const exists = (existingJson.agents || []).some(
                    (agent) => (agent.signature || "").toLowerCase() === signature.toLowerCase()
                );
                if (exists) {
                    throw new Error("An agent with this name already exists. Choose a different name.");
                }
            }

            const config = {
                livebench: {
                    date_range: {
                        init_date: new Date().toISOString().split('T')[0],
                        end_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 10 days
                    },
                    economic: {
                        initial_balance: parseFloat(initialBalance),
                        token_pricing: {
                            input_per_1m: 2.5,
                            output_per_1m: 10.0
                        }
                    },
                    agents: [
                        {
                            signature,
                            basemodel: model,
                            enabled: true,
                            tasks_per_day: 1,
                            supports_multimodal: true
                        }
                    ],
                    agent_params: {
                        max_steps: 20,
                        max_retries: 3,
                        base_delay: 0.5,
                        tasks_per_day: 1
                    },
                    evaluation: {
                        use_llm_evaluation: true
                    },
                    data_path: "./livebench/data/agent_data",
                    gdpval_path: "./gdpval"
                }
            };

            const response = await fetch(`${API_BASE}/simulations`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    config
                })
            });

            if (!response.ok) {
                const raw = await response.text();
                let detail = raw;
                try {
                    const parsed = JSON.parse(raw) as { detail?: string; error?: string };
                    detail = parsed.detail || parsed.error || raw;
                } catch {
                    // keep raw response body as detail
                }
                throw new Error(detail || `Request failed (${response.status})`);
            }

            mutate(`${API_BASE}/agents`);
            mutate(`${API_BASE}/simulations`);
            setAgentName(suggestAgentName());
            setOpen(false);
        } catch (error) {
            console.error("Error launching agent:", error);
            setErrorMessage(error instanceof Error ? error.message : "Failed to launch agent.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    type="button"
                    onClick={() => {
                        setErrorMessage("");
                        setAgentName(suggestAgentName());
                        setProvider("openai");
                        setModel(PROVIDER_MODELS.openai[0].value);
                        setOpen(true);
                    }}
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Hire New Agent
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Hire New AI Coworker</DialogTitle>
                    <DialogDescription>
                        Configure your new AI agent&apos;s profile and initial budget.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                            Name
                        </Label>
                        <Input
                            id="name"
                            value={agentName}
                            onChange={(e) => setAgentName(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="provider" className="text-right">
                            Provider
                        </Label>
                        <Select
                            value={provider}
                            onValueChange={(value) => {
                                const selected = value as Provider;
                                setProvider(selected);
                                setModel(PROVIDER_MODELS[selected][0].value);
                            }}
                        >
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select provider" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="openai">OpenAI</SelectItem>
                                <SelectItem value="anthropic">Anthropic</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="model" className="text-right">
                            Model
                        </Label>
                        <Select value={model} onValueChange={setModel}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select model" />
                            </SelectTrigger>
                            <SelectContent>
                                {PROVIDER_MODELS[provider].map((entry) => (
                                    <SelectItem key={entry.value} value={entry.value}>
                                        {entry.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Select the AI provider/model for this agent. Ensure the matching API credentials are configured in ClawWork.
                    </p>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="balance" className="text-right">
                            Budget ($)
                        </Label>
                        <Input
                            id="balance"
                            type="number"
                            value={initialBalance}
                            onChange={(e) => setInitialBalance(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    {errorMessage && (
                        <p className="text-sm text-red-600">{errorMessage}</p>
                    )}
                </div>
                <DialogFooter>
                    <Button type="button" onClick={handleLaunch} disabled={loading}>
                        {loading ? "Launching..." : "Launch Agent"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
