import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole, hasRole } from "@/lib/rbac";

type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
type TaskPriority = "low" | "medium" | "high";
type ApprovalAction = "request" | "approve" | "reject";
type EscalationPolicy = "none" | "warn" | "urgent" | "blocker";

function isValidApprovalAction(value: string): value is ApprovalAction {
    return ["request", "approve", "reject"].includes(value);
}

function latestApprovalState(history: unknown[]): "none" | "pending" | "approved" | "rejected" {
    for (let i = history.length - 1; i >= 0; i -= 1) {
        const entry = history[i];
        if (!entry || typeof entry !== "object") continue;
        const action = "action" in entry ? String((entry as { action?: unknown }).action || "") : "";
        if (action === "approval_requested") return "pending";
        if (action === "approval_approved") return "approved";
        if (action === "approval_rejected") return "rejected";
    }
    return "none";
}

function latestPendingApprovalRequest(history: unknown[]): Record<string, unknown> | null {
    let pending: Record<string, unknown> | null = null;
    for (let i = 0; i < history.length; i += 1) {
        const entry = history[i];
        if (!entry || typeof entry !== "object") continue;
        const normalized = entry as Record<string, unknown>;
        const action = String(normalized.action || "");
        if (action === "approval_requested") {
            pending = normalized;
        }
        if (action === "approval_approved" || action === "approval_rejected") {
            pending = null;
        }
    }
    return pending;
}

function isValidStatus(value: string): value is TaskStatus {
    return ["todo", "in_progress", "blocked", "done"].includes(value);
}

function isValidPriority(value: string): value is TaskPriority {
    return ["low", "medium", "high"].includes(value);
}

function isValidEscalationPolicy(value: string): value is EscalationPolicy {
    return ["none", "warn", "urgent", "blocker"].includes(value);
}

function isMissingCoworkerTableError(error: unknown): boolean {
    const code = typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code || "")
        : "";
    const message = typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message || "")
        : "";
    return code === "42P01" || /coworker_tasks/i.test(message);
}

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = await getCurrentUserRole(user.id);
    if (!role) {
        return NextResponse.json(
            { error: "RBAC role not configured. Assign maker/checker/admin in public.user_roles." },
            { status: 403 },
        );
    }

    const { data: existing, error: existingError } = await supabase
        .from("coworker_tasks")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

    if (existingError || !existing) {
        if (isMissingCoworkerTableError(existingError)) {
            return NextResponse.json(
                { error: "Coworker task table not found. Run Supabase schema migration first." },
                { status: 503 },
            );
        }
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    const history = Array.isArray(existing.history) ? [...existing.history] : [];
    const now = new Date().toISOString();

    if (body.status !== undefined) {
        if (!hasRole(role, ["maker", "admin"])) {
            return NextResponse.json({ error: "Only maker or admin can update task status" }, { status: 403 });
        }
        const statusRaw = String(body.status || "").trim();
        if (!isValidStatus(statusRaw)) {
            return NextResponse.json({ error: "Invalid status" }, { status: 400 });
        }
        patch.status = statusRaw;
        if (statusRaw === "in_progress" && !existing.started_at) patch.started_at = now;
        if (statusRaw === "done") patch.completed_at = now;
        if (statusRaw !== "done") patch.completed_at = null;
        history.push({ at: now, action: "status_updated", status: statusRaw });
    }

    if (body.priority !== undefined) {
        if (!hasRole(role, ["maker", "admin"])) {
            return NextResponse.json({ error: "Only maker or admin can update task priority" }, { status: 403 });
        }
        const priorityRaw = String(body.priority || "").trim();
        if (!isValidPriority(priorityRaw)) {
            return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
        }
        patch.priority = priorityRaw;
        history.push({ at: now, action: "priority_updated", priority: priorityRaw });
    }

    if (body.assigned_agent !== undefined) {
        if (!hasRole(role, ["maker", "admin"])) {
            return NextResponse.json({ error: "Only maker or admin can assign agents" }, { status: 403 });
        }
        const assignedAgent = String(body.assigned_agent || "").trim();
        patch.assigned_agent = assignedAgent || null;
        history.push({ at: now, action: "agent_assigned", assigned_agent: assignedAgent || null });
    }

    if (body.result_summary !== undefined) {
        if (!hasRole(role, ["maker", "admin"])) {
            return NextResponse.json({ error: "Only maker or admin can update results" }, { status: 403 });
        }
        const resultSummary = String(body.result_summary || "").trim();
        if (resultSummary.length > 8000) {
            return NextResponse.json({ error: "Result summary too long" }, { status: 400 });
        }
        patch.result_summary = resultSummary || null;
        history.push({ at: now, action: "result_updated" });
    }

    if (body.due_at !== undefined || body.escalation_policy !== undefined) {
        if (!hasRole(role, ["maker", "admin"])) {
            return NextResponse.json({ error: "Only maker or admin can update SLA settings" }, { status: 403 });
        }
        const dueAtRaw = String(body.due_at || "").trim();
        const dueAt = dueAtRaw ? new Date(dueAtRaw) : null;
        if (dueAt && Number.isNaN(dueAt.getTime())) {
            return NextResponse.json({ error: "Invalid due_at timestamp" }, { status: 400 });
        }
        const escalationPolicyRaw = String(body.escalation_policy || "none").trim().toLowerCase();
        if (!isValidEscalationPolicy(escalationPolicyRaw)) {
            return NextResponse.json({ error: "Invalid escalation policy" }, { status: 400 });
        }
        history.push({
            at: now,
            action: "sla_updated",
            due_at: dueAt ? dueAt.toISOString() : null,
            escalation_policy: escalationPolicyRaw,
            updated_by: user.id,
        });
    }

    if (body.approval_action !== undefined) {
        const actionRaw = String(body.approval_action || "").trim().toLowerCase();
        if (!isValidApprovalAction(actionRaw)) {
            return NextResponse.json({ error: "Invalid approval action" }, { status: 400 });
        }
        if (actionRaw === "request" && !hasRole(role, ["maker", "admin"])) {
            return NextResponse.json({ error: "Only maker or admin can request approval" }, { status: 403 });
        }
        if ((actionRaw === "approve" || actionRaw === "reject") && !hasRole(role, ["checker", "admin"])) {
            return NextResponse.json({ error: "Only checker or admin can approve/reject" }, { status: 403 });
        }
        const note = String(body.approval_note || "").trim();
        if (note.length > 2000) {
            return NextResponse.json({ error: "Approval note too long" }, { status: 400 });
        }
        if (actionRaw === "reject" && !note) {
            return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 });
        }
        const currentState = latestApprovalState(history);
        if ((actionRaw === "approve" || actionRaw === "reject") && currentState !== "pending") {
            return NextResponse.json({ error: "No pending approval request for this task" }, { status: 409 });
        }
        if ((actionRaw === "approve" || actionRaw === "reject") && role === "maker") {
            return NextResponse.json({ error: "Maker role cannot approve or reject requests" }, { status: 403 });
        }
        const assigneeRaw = String(body.approval_assignee || "").trim();
        if (assigneeRaw.length > 120) {
            return NextResponse.json({ error: "Approval assignee is too long" }, { status: 400 });
        }
        const pendingRequest = latestPendingApprovalRequest(history);
        const pendingAssignee = pendingRequest ? String(pendingRequest.assignee || "").trim() : "";
        if ((actionRaw === "approve" || actionRaw === "reject") && pendingAssignee && pendingAssignee !== user.id) {
            return NextResponse.json(
                { error: "Only the assigned approver can approve or reject this task" },
                { status: 403 },
            );
        }

        if (actionRaw === "request") {
            patch.status = "blocked";
            patch.completed_at = null;
            history.push({
                at: now,
                action: "approval_requested",
                note: note || null,
                requested_by: user.id,
                assignee: assigneeRaw || null,
            });
        } else if (actionRaw === "approve") {
            patch.status = "todo";
            patch.completed_at = null;
            history.push({
                at: now,
                action: "approval_approved",
                note: note || null,
                approved_by: user.id,
            });
        } else {
            patch.status = "blocked";
            patch.completed_at = null;
            history.push({
                at: now,
                action: "approval_rejected",
                note: note || null,
                rejected_by: user.id,
            });
        }
    }

    patch.history = history;
    patch.updated_at = now;

    const { data, error } = await supabase
        .from("coworker_tasks")
        .update(patch)
        .eq("id", id)
        .eq("user_id", user.id)
        .select("*")
        .single();

    if (error) {
        if (isMissingCoworkerTableError(error)) {
            return NextResponse.json(
                { error: "Coworker task table not found. Run Supabase schema migration first." },
                { status: 503 },
            );
        }
        return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
    }

    return NextResponse.json({ task: data });
}
