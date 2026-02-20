"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
type TaskPriority = "low" | "medium" | "high";
type TaskTemplateCategory = "business" | "personal";

type TaskTemplate = {
    id: string;
    name: string;
    category: TaskTemplateCategory;
    title: string;
    description: string;
    priority: TaskPriority;
    requiresApproval: boolean;
};

type CoworkerTask = {
    id: string;
    title: string;
    description?: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    assigned_agent?: string | null;
    result_summary?: string | null;
    history?: Array<Record<string, unknown>>;
    created_at: string;
    updated_at: string;
};

type AgentRecord = { signature: string };
type SimulationRecord = { id: string; status?: string; start_time?: string; end_time?: string };
type ApprovalState = "none" | "pending" | "approved" | "rejected";
type AppRole = "maker" | "checker" | "admin";

const fetcher = async <T,>(url: string): Promise<T> => {
    const res = await fetch(url);
    const txt = await res.text();
    if (!res.ok) {
        throw new Error(parseApiError(txt, res.status));
    }
    return JSON.parse(txt) as T;
};

function parseApiError(text: string, status?: number): string {
    if (!text) return status ? `HTTP ${status}` : "Request failed";
    try {
        const payload = JSON.parse(text) as Record<string, unknown>;
        const message = String(payload.error || payload.detail || payload.message || "").trim();
        if (message) return message;
    } catch {
        // Keep raw text fallback when response is not JSON.
    }
    return text;
}

const statusLabel: Record<TaskStatus, string> = {
    todo: "To Do",
    in_progress: "In Progress",
    blocked: "Blocked",
    done: "Done",
};

const priorityClass: Record<TaskPriority, string> = {
    low: "bg-slate-100 text-slate-700",
    medium: "bg-blue-100 text-blue-700",
    high: "bg-red-100 text-red-700",
};

const approvalBadgeClass: Record<ApprovalState, string> = {
    none: "bg-slate-100 text-slate-700",
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-rose-100 text-rose-800",
};

export function CoworkerTaskBoard() {
    const { data, mutate, isLoading, error } = useSWR<{ tasks: CoworkerTask[] }>("/api/coworker/tasks", fetcher, {
        refreshInterval: 8000,
    });
    const { data: agentsData } = useSWR<{ agents: AgentRecord[] }>("/api/clawwork/agents", fetcher, {
        refreshInterval: 15000,
    });
    const { data: simulationsData } = useSWR<{ simulations: SimulationRecord[] }>("/api/clawwork/simulations", fetcher, {
        refreshInterval: 6000,
    });
    const { data: templatesData } = useSWR<{ templates: TaskTemplate[] }>("/api/coworker/templates", fetcher);
    const { data: roleData } = useSWR<{ role: AppRole }>("/api/rbac/me", fetcher);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState<TaskPriority>("medium");
    const [assignedAgent, setAssignedAgent] = useState("__unassigned");
    const [selectedTemplateId, setSelectedTemplateId] = useState("__custom");
    const [resultDraft, setResultDraft] = useState<Record<string, string>>({});
    const [approvalNoteDraft, setApprovalNoteDraft] = useState<Record<string, string>>({});
    const [approvalAssigneeDraft, setApprovalAssigneeDraft] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
    const [exportingFormat, setExportingFormat] = useState<"csv" | "json" | null>(null);
    const [message, setMessage] = useState<string>("");

    const tasks = data?.tasks || [];
    const templates = templatesData?.templates || [];
    const role = roleData?.role || null;
    const agentOptions = useMemo(
        () =>
            Array.from(
                new Set((agentsData?.agents || []).map((agent) => String(agent.signature || "").trim()).filter(Boolean)),
            ),
        [agentsData],
    );

    const counts = useMemo(() => {
        const status = { todo: 0, in_progress: 0, blocked: 0, done: 0 } as Record<TaskStatus, number>;
        for (const task of tasks) status[task.status] += 1;
        return status;
    }, [tasks]);

    const pendingApprovalTasks = useMemo(
        () => tasks.filter((task) => latestApprovalState(task) === "pending"),
        [tasks],
    );

    const templatesById = useMemo(() => {
        const map = new Map<string, TaskTemplate>();
        for (const template of templates) map.set(template.id, template);
        return map;
    }, [templates]);

    const businessTemplates = templates.filter((template) => template.category === "business");
    const personalTemplates = templates.filter((template) => template.category === "personal");

    async function createTask() {
        setSubmitting(true);
        setMessage("");
        try {
            const res = await fetch("/api/coworker/tasks", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    title,
                    description,
                    priority,
                    template_id: selectedTemplateId === "__custom" ? null : selectedTemplateId,
                    requires_approval: selectedTemplateId !== "__custom"
                        ? Boolean(templatesById.get(selectedTemplateId)?.requiresApproval)
                        : false,
                    assigned_agent: assignedAgent === "__unassigned" ? null : assignedAgent,
                }),
            });
            const txt = await res.text();
            if (!res.ok) throw new Error(parseApiError(txt, res.status));
            setTitle("");
            setDescription("");
            setPriority("medium");
            setAssignedAgent("__unassigned");
            setSelectedTemplateId("__custom");
            setMessage("Task created.");
            await mutate();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : "Failed to create task");
        } finally {
            setSubmitting(false);
        }
    }

    async function patchTask(id: string, patch: Record<string, unknown>) {
        const res = await fetch(`/api/coworker/tasks/${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(patch),
        });
        const txt = await res.text();
        if (!res.ok) throw new Error(parseApiError(txt, res.status));
        await mutate();
    }

    async function performTaskAction(action: () => Promise<void>) {
        setMessage("");
        try {
            await action();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : "Task action failed");
        }
    }

    async function runTask(id: string) {
        setRunningTaskId(id);
        setMessage("");
        try {
            const res = await fetch(`/api/coworker/tasks/${encodeURIComponent(id)}/run`, {
                method: "POST",
            });
            const txt = await res.text();
            if (!res.ok) throw new Error(parseApiError(txt, res.status));
            setMessage("Task launched.");
            await mutate();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : "Failed to run task");
        } finally {
            setRunningTaskId(null);
        }
    }

    const simulationsById = useMemo(() => {
        const map = new Map<string, SimulationRecord>();
        for (const simulation of simulationsData?.simulations || []) {
            if (simulation.id) map.set(simulation.id, simulation);
        }
        return map;
    }, [simulationsData]);

    function latestSimulationId(task: CoworkerTask): string | null {
        const entries = Array.isArray(task.history) ? [...task.history].reverse() : [];
        for (const entry of entries) {
            const simulationId = entry && typeof entry === "object" && "simulation_id" in entry
                ? String((entry as { simulation_id?: unknown }).simulation_id || "")
                : "";
            if (simulationId) return simulationId;
        }
        return null;
    }

    function latestApprovalState(task: CoworkerTask): ApprovalState {
        const entries = Array.isArray(task.history) ? [...task.history].reverse() : [];
        for (const entry of entries) {
            if (!entry || typeof entry !== "object") continue;
            const action = "action" in entry ? String((entry as { action?: unknown }).action || "") : "";
            if (action === "approval_requested") return "pending";
            if (action === "approval_approved") return "approved";
            if (action === "approval_rejected") return "rejected";
        }
        return "none";
    }

    function latestPendingApproval(task: CoworkerTask): { assignee: string; note: string } | null {
        const entries = Array.isArray(task.history) ? task.history : [];
        let pending: { assignee: string; note: string } | null = null;
        for (const entry of entries) {
            if (!entry || typeof entry !== "object") continue;
            const action = String((entry as { action?: unknown }).action || "");
            if (action === "approval_requested") {
                pending = {
                    assignee: String((entry as { assignee?: unknown }).assignee || ""),
                    note: String((entry as { note?: unknown }).note || ""),
                };
            }
            if (action === "approval_approved" || action === "approval_rejected") {
                pending = null;
            }
        }
        return pending;
    }

    function applyTemplate(value: string) {
        setSelectedTemplateId(value);
        if (value === "__custom") return;
        const template = templatesById.get(value);
        if (!template) return;
        setTitle(template.title);
        setDescription(template.description);
        setPriority(template.priority);
    }

    async function exportTasks(format: "csv" | "json") {
        setExportingFormat(format);
        setMessage("");
        try {
            const res = await fetch(`/api/coworker/tasks/export?format=${format}`, { method: "GET" });
            const contentType = res.headers.get("content-type") || "";
            if (!res.ok) {
                const txt = await res.text();
                throw new Error(parseApiError(txt, res.status));
            }

            if (format === "csv") {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `coworker_tasks_${new Date().toISOString().slice(0, 10)}.csv`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
                setMessage("CSV exported.");
                return;
            }

            const jsonData = contentType.includes("application/json")
                ? await res.json()
                : await res.text();
            const jsonBlob = new Blob([JSON.stringify(jsonData, null, 2)], { type: "application/json" });
            const url = window.URL.createObjectURL(jsonBlob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `coworker_tasks_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            setMessage("JSON exported.");
        } catch (err) {
            setMessage(err instanceof Error ? err.message : "Failed to export tasks");
        } finally {
            setExportingFormat(null);
        }
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                        <CardTitle>The Coworker Layer</CardTitle>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => exportTasks("json")}
                                disabled={!!exportingFormat}
                            >
                                {exportingFormat === "json" ? "Exporting..." : "Export JSON"}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => exportTasks("csv")}
                                disabled={!!exportingFormat}
                            >
                                {exportingFormat === "csv" ? "Exporting..." : "Export CSV"}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <Label>Task Template</Label>
                            <Select value={selectedTemplateId} onValueChange={applyTemplate}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Choose template" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__custom">Custom Task</SelectItem>
                                    {businessTemplates.length > 0 ? (
                                        <SelectItem value="__header_business" disabled>
                                            Business
                                        </SelectItem>
                                    ) : null}
                                    {businessTemplates.map((template) => (
                                        <SelectItem key={template.id} value={template.id}>
                                            {template.name}
                                        </SelectItem>
                                    ))}
                                    {personalTemplates.length > 0 ? (
                                        <SelectItem value="__header_personal" disabled>
                                            Personal
                                        </SelectItem>
                                    ) : null}
                                    {personalTemplates.map((template) => (
                                        <SelectItem key={template.id} value={template.id}>
                                            {template.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="task-title">Task Title</Label>
                            <Input
                                id="task-title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Prepare Q1 budget variance report"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="task-desc">Task Description</Label>
                            <Textarea
                                id="task-desc"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Include assumptions, top anomalies, and actions."
                            />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <Label>Priority</Label>
                            <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Assign Agent (optional)</Label>
                            <Select value={assignedAgent} onValueChange={setAssignedAgent}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Unassigned" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__unassigned">Unassigned</SelectItem>
                                    {agentOptions.map((signature) => (
                                        <SelectItem key={signature} value={signature}>
                                            {signature}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            onClick={createTask}
                            disabled={submitting || !title.trim() || !(role === "maker" || role === "admin")}
                            className="w-full"
                        >
                            {submitting ? "Creating..." : "Create Coworker Task"}
                        </Button>
                        {role ? <p className="text-xs text-muted-foreground">Your role: {role}</p> : null}
                        {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-4">
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm">To Do</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{counts.todo}</CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm">In Progress</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{counts.in_progress}</CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Blocked</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{counts.blocked}</CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Done</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{counts.done}</CardContent></Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Approval Queue</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {pendingApprovalTasks.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No pending approvals.</p>
                    ) : (
                        pendingApprovalTasks.map((task) => (
                            <div key={`approval-${task.id}`} className="rounded-md border p-3 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="font-medium truncate">{task.title}</p>
                                    <Badge className={approvalBadgeClass.pending}>approval: pending</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Agent: {task.assigned_agent || "Unassigned"} | Updated {new Date(task.updated_at).toLocaleString()}
                                </p>
                                <div className="flex gap-2">
                                    <Input
                                        value={approvalNoteDraft[task.id] || ""}
                                        onChange={(e) => setApprovalNoteDraft((prev) => ({ ...prev, [task.id]: e.target.value }))}
                                        placeholder="Approval note (required for reject)"
                                    />
                                    <Input
                                        value={approvalAssigneeDraft[task.id] || ""}
                                        onChange={(e) => setApprovalAssigneeDraft((prev) => ({ ...prev, [task.id]: e.target.value }))}
                                        placeholder="Approver user ID (optional)"
                                    />
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={!(role === "checker" || role === "admin")}
                                        onClick={() => performTaskAction(() => patchTask(task.id, {
                                            approval_action: "approve",
                                            approval_note: approvalNoteDraft[task.id] || "",
                                        }))}
                                    >
                                        Approve
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={!(role === "checker" || role === "admin")}
                                        onClick={() => performTaskAction(() => patchTask(task.id, {
                                            approval_action: "reject",
                                            approval_note: approvalNoteDraft[task.id] || "",
                                        }))}
                                    >
                                        Reject
                                    </Button>
                                </div>
                                {(() => {
                                    const pending = latestPendingApproval(task);
                                    if (!pending) return null;
                                    return (
                                        <p className="text-xs text-muted-foreground">
                                            Pending note: {pending.note || "-"} | Assignee: {pending.assignee || "Any approver"}
                                        </p>
                                    );
                                })()}
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Task Lifecycle</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {error ? <p className="text-sm text-red-700">Failed to load tasks.</p> : null}
                    {isLoading ? <p className="text-sm text-muted-foreground">Loading tasks...</p> : null}
                    {!isLoading && tasks.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No coworker tasks yet. Create the first task above.</p>
                    ) : null}
                    {tasks.map((task) => (
                        <div key={task.id} className="rounded-md border p-3 space-y-2">
                            {(() => {
                                const simId = latestSimulationId(task);
                                const sim = simId ? simulationsById.get(simId) : null;
                                const simulationStatus = sim?.status ? String(sim.status) : null;
                                const approvalState = latestApprovalState(task);
                                return (
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="font-medium truncate">{task.title}</p>
                                        <div className="flex gap-2">
                                            <Badge variant="outline">{statusLabel[task.status]}</Badge>
                                            <Badge className={priorityClass[task.priority]}>{task.priority}</Badge>
                                            {approvalState !== "none" ? (
                                                <Badge className={approvalBadgeClass[approvalState]}>
                                                    approval: {approvalState}
                                                </Badge>
                                            ) : null}
                                            {simulationStatus ? (
                                                <Badge variant="secondary">{simulationStatus}</Badge>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })()}
                            {task.description ? <p className="text-sm text-muted-foreground">{task.description}</p> : null}
                            <p className="text-xs text-muted-foreground">
                                Agent: {task.assigned_agent || "Unassigned"} | Updated {new Date(task.updated_at).toLocaleString()}
                            </p>
                            {(() => {
                                const simId = latestSimulationId(task);
                                if (!simId) return null;
                                const sim = simulationsById.get(simId);
                                return (
                                    <p className="text-xs text-muted-foreground">
                                        Last simulation: {simId}
                                        {sim?.status ? ` (${sim.status})` : ""}
                                    </p>
                                );
                            })()}
                            {task.result_summary ? (
                                <p className="text-sm rounded bg-muted p-2">
                                    <span className="font-medium">Result:</span> {task.result_summary}
                                </p>
                            ) : null}
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={!(role === "maker" || role === "admin")}
                                    onClick={() => patchTask(task.id, { status: "in_progress" })}
                                >
                                    Start
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={!(role === "maker" || role === "admin")}
                                    onClick={() => patchTask(task.id, { status: "blocked" })}
                                >
                                    Block
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={!(role === "maker" || role === "admin")}
                                    onClick={() => patchTask(task.id, { status: "todo" })}
                                >
                                    Reopen
                                </Button>
                                <Button
                                    size="sm"
                                    disabled={!(role === "maker" || role === "admin")}
                                    onClick={() => patchTask(task.id, { status: "done" })}
                                >
                                    Complete
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={latestApprovalState(task) === "pending" || !(role === "maker" || role === "admin")}
                                    onClick={() => performTaskAction(() => patchTask(task.id, {
                                        approval_action: "request",
                                        approval_note: approvalNoteDraft[task.id] || "",
                                        approval_assignee: approvalAssigneeDraft[task.id] || "",
                                    }))}
                                >
                                    Request Approval
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={latestApprovalState(task) !== "pending" || !(role === "checker" || role === "admin")}
                                    onClick={() => performTaskAction(() => patchTask(task.id, {
                                        approval_action: "approve",
                                        approval_note: approvalNoteDraft[task.id] || "",
                                    }))}
                                >
                                    Approve
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={latestApprovalState(task) !== "pending" || !(role === "checker" || role === "admin")}
                                    onClick={() => performTaskAction(() => patchTask(task.id, {
                                        approval_action: "reject",
                                        approval_note: approvalNoteDraft[task.id] || "",
                                    }))}
                                >
                                    Reject
                                </Button>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={
                                        runningTaskId === task.id
                                        || latestApprovalState(task) === "pending"
                                        || !(role === "maker" || role === "admin")
                                    }
                                    onClick={() => runTask(task.id)}
                                >
                                    {runningTaskId === task.id ? "Launching..." : "Run Task"}
                                </Button>
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    value={approvalNoteDraft[task.id] || ""}
                                    onChange={(e) => setApprovalNoteDraft((prev) => ({ ...prev, [task.id]: e.target.value }))}
                                    placeholder="Approval note (required for reject)"
                                />
                                <Input
                                    value={approvalAssigneeDraft[task.id] || ""}
                                    onChange={(e) => setApprovalAssigneeDraft((prev) => ({ ...prev, [task.id]: e.target.value }))}
                                    placeholder="Approver user ID (optional)"
                                />
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={latestApprovalState(task) === "pending" || !(role === "maker" || role === "admin")}
                                    onClick={() => performTaskAction(() => patchTask(task.id, {
                                        approval_action: "request",
                                        approval_note: approvalNoteDraft[task.id] || "",
                                        approval_assignee: approvalAssigneeDraft[task.id] || "",
                                    }))}
                                >
                                    Submit for Approval
                                </Button>
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    value={resultDraft[task.id] || ""}
                                    onChange={(e) => setResultDraft((prev) => ({ ...prev, [task.id]: e.target.value }))}
                                    placeholder="Add result/summary..."
                                />
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={!(role === "maker" || role === "admin")}
                                    onClick={() => patchTask(task.id, { result_summary: resultDraft[task.id] || "" })}
                                >
                                    Save Result
                                </Button>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
