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
type ModelOption = { value: string; label: string; provider: string };
type RunConfigDraft = { model: string; maxSteps: number; maxRetries: number };

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
    const { data: modelData } = useSWR<{ models: ModelOption[] }>("/api/models/available", fetcher);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState<TaskPriority>("medium");
    const [assignedAgent, setAssignedAgent] = useState("__unassigned");
    const [selectedTemplateId, setSelectedTemplateId] = useState("__custom");
    const [resultDraft, setResultDraft] = useState<Record<string, string>>({});
    const [approvalNoteDraft, setApprovalNoteDraft] = useState<Record<string, string>>({});
    const [approvalAssigneeDraft, setApprovalAssigneeDraft] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [submittingAndRunning, setSubmittingAndRunning] = useState(false);
    const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
    const [exportingFormat, setExportingFormat] = useState<"csv" | "json" | null>(null);
    const [runConfigDraft, setRunConfigDraft] = useState<Record<string, RunConfigDraft>>({});
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
    const [priorityFilter, setPriorityFilter] = useState<"all" | TaskPriority>("all");
    const [approvalFilter, setApprovalFilter] = useState<"all" | ApprovalState>("all");
    const [message, setMessage] = useState<string>("");

    const tasks = data?.tasks || [];
    const templates = templatesData?.templates || [];
    const availableModels = modelData?.models || [];
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

    const filteredTasks = useMemo(() => {
        return tasks.filter((task) => {
            const statusMatch = statusFilter === "all" || task.status === statusFilter;
            const priorityMatch = priorityFilter === "all" || task.priority === priorityFilter;
            const approvalMatch = approvalFilter === "all" || latestApprovalState(task) === approvalFilter;
            const query = searchQuery.trim().toLowerCase();
            const textMatch = !query
                || task.title.toLowerCase().includes(query)
                || String(task.description || "").toLowerCase().includes(query)
                || String(task.assigned_agent || "").toLowerCase().includes(query)
                || String(task.result_summary || "").toLowerCase().includes(query);
            return statusMatch && priorityMatch && approvalMatch && textMatch;
        });
    }, [tasks, statusFilter, priorityFilter, approvalFilter, searchQuery]);

    const templatesById = useMemo(() => {
        const map = new Map<string, TaskTemplate>();
        for (const template of templates) map.set(template.id, template);
        return map;
    }, [templates]);

    const businessTemplates = templates.filter((template) => template.category === "business");
    const personalTemplates = templates.filter((template) => template.category === "personal");

    async function createTask(runImmediately: boolean) {
        if (runImmediately) {
            setSubmittingAndRunning(true);
        } else {
            setSubmitting(true);
        }
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
            const created = JSON.parse(txt) as { task?: CoworkerTask };

            setTitle("");
            setDescription("");
            setPriority("medium");
            setAssignedAgent("__unassigned");
            setSelectedTemplateId("__custom");
            await mutate();

            if (runImmediately && created.task?.id) {
                await runTask(created.task.id, getRunConfig(created.task.id));
                return;
            }

            setMessage("Task created.");
        } catch (err) {
            setMessage(err instanceof Error ? err.message : "Failed to create task");
        } finally {
            setSubmitting(false);
            setSubmittingAndRunning(false);
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

    function getRunConfig(taskId: string): RunConfigDraft {
        return runConfigDraft[taskId] || { model: "", maxSteps: 20, maxRetries: 2 };
    }

    async function runTask(id: string, config?: RunConfigDraft) {
        setRunningTaskId(id);
        setMessage("");
        try {
            const res = await fetch(`/api/coworker/tasks/${encodeURIComponent(id)}/run`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    model: (config?.model || "").trim() || undefined,
                    max_steps: config?.maxSteps,
                    max_retries: config?.maxRetries,
                }),
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

    function formatHistoryEvent(entry: Record<string, unknown>): string {
        const action = String(entry.action || "event");
        if (action === "approval_requested") return "Approval requested";
        if (action === "approval_approved") return "Approval approved";
        if (action === "approval_rejected") return "Approval rejected";
        if (action === "simulation_started") return "Simulation started";
        if (action === "created") return "Task created";
        return action.replaceAll("_", " ");
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
                        <div className="grid gap-2 sm:grid-cols-2">
                            <Button
                                onClick={() => createTask(false)}
                                disabled={
                                    submitting
                                    || submittingAndRunning
                                    || !title.trim()
                                    || !(role === "maker" || role === "admin")
                                }
                                className="w-full"
                            >
                                {submitting ? "Creating..." : "Create Coworker Task"}
                            </Button>
                            <Button
                                onClick={() => createTask(true)}
                                disabled={
                                    submitting
                                    || submittingAndRunning
                                    || !title.trim()
                                    || !(role === "maker" || role === "admin")
                                }
                                className="w-full"
                                variant="secondary"
                            >
                                {submittingAndRunning ? "Creating + Launching..." : "Create & Run"}
                            </Button>
                        </div>
                        {role ? <p className="text-xs text-muted-foreground">Your role: {role}</p> : null}
                        {role === "checker" ? (
                            <p className="text-xs text-muted-foreground">
                                Checker view: you can approve/reject tasks but cannot create or launch runs.
                            </p>
                        ) : null}
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
                    <div className="flex flex-col gap-3">
                        <CardTitle>Task Lifecycle</CardTitle>
                        <div className="grid gap-2 md:grid-cols-4">
                            <Input
                                placeholder="Search title/description/agent..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | TaskStatus)}>
                                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="todo">To Do</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="blocked">Blocked</SelectItem>
                                    <SelectItem value="done">Done</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as "all" | TaskPriority)}>
                                <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Priorities</SelectItem>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={approvalFilter} onValueChange={(value) => setApprovalFilter(value as "all" | ApprovalState)}>
                                <SelectTrigger><SelectValue placeholder="Approval" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Approval States</SelectItem>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="approved">Approved</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                                Showing {filteredTasks.length} of {tasks.length} tasks.
                            </p>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    setSearchQuery("");
                                    setStatusFilter("all");
                                    setPriorityFilter("all");
                                    setApprovalFilter("all");
                                }}
                            >
                                Clear Filters
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    {error ? <p className="text-sm text-red-700">Failed to load tasks.</p> : null}
                    {isLoading ? <p className="text-sm text-muted-foreground">Loading tasks...</p> : null}
                    {!isLoading && tasks.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No coworker tasks yet. Create the first task above.</p>
                    ) : null}
                    {!isLoading && tasks.length > 0 && filteredTasks.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No tasks match the current filters.</p>
                    ) : null}
                    {filteredTasks.map((task) => (
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
                            <div className="grid gap-2 md:grid-cols-3">
                                <div className="space-y-1">
                                    <Label className="text-xs">Run model override</Label>
                                    <Select
                                        value={getRunConfig(task.id).model || "__workspace_default"}
                                        onValueChange={(value) =>
                                            setRunConfigDraft((prev) => ({
                                                ...prev,
                                                [task.id]: {
                                                    ...getRunConfig(task.id),
                                                    model: value === "__workspace_default" ? "" : value,
                                                },
                                            }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Workspace default" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__workspace_default">Workspace default</SelectItem>
                                            {availableModels.map((model) => (
                                                <SelectItem key={model.value} value={model.value}>
                                                    {model.label} ({model.provider})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Max steps (1-60)</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={60}
                                        value={getRunConfig(task.id).maxSteps}
                                        onChange={(e) =>
                                            setRunConfigDraft((prev) => ({
                                                ...prev,
                                                [task.id]: {
                                                    ...getRunConfig(task.id),
                                                    maxSteps: Math.max(1, Math.min(60, Number(e.target.value || 20))),
                                                },
                                            }))}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Max retries (0-10)</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={10}
                                        value={getRunConfig(task.id).maxRetries}
                                        onChange={(e) =>
                                            setRunConfigDraft((prev) => ({
                                                ...prev,
                                                [task.id]: {
                                                    ...getRunConfig(task.id),
                                                    maxRetries: Math.max(0, Math.min(10, Number(e.target.value || 2))),
                                                },
                                            }))}
                                    />
                                </div>
                            </div>
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
                                    onClick={() => runTask(task.id, getRunConfig(task.id))}
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
                            <details className="rounded-md border bg-muted/30 p-2">
                                <summary className="cursor-pointer text-sm font-medium">Audit Timeline</summary>
                                <div className="mt-2 space-y-2">
                                    {(Array.isArray(task.history) && task.history.length > 0) ? (
                                        [...task.history].reverse().slice(0, 12).map((entry, index) => {
                                            const record = entry as Record<string, unknown>;
                                            const when = String(record.at || "");
                                            const note = String(record.note || "");
                                            return (
                                                <div key={`${task.id}-history-${index}`} className="rounded border bg-background p-2 text-xs">
                                                    <p className="font-medium">{formatHistoryEvent(record)}</p>
                                                    <p className="text-muted-foreground">{when ? new Date(when).toLocaleString() : "Unknown time"}</p>
                                                    {record.simulation_id ? (
                                                        <p className="text-muted-foreground">Simulation: {String(record.simulation_id)}</p>
                                                    ) : null}
                                                    {record.assignee ? (
                                                        <p className="text-muted-foreground">Assignee: {String(record.assignee)}</p>
                                                    ) : null}
                                                    {note ? <p className="text-muted-foreground">Note: {note}</p> : null}
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <p className="text-xs text-muted-foreground">No audit entries.</p>
                                    )}
                                </div>
                            </details>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
