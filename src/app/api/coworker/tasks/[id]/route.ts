import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
type TaskPriority = "low" | "medium" | "high";

function isValidStatus(value: string): value is TaskStatus {
    return ["todo", "in_progress", "blocked", "done"].includes(value);
}

function isValidPriority(value: string): value is TaskPriority {
    return ["low", "medium", "high"].includes(value);
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

    const { data: existing, error: existingError } = await supabase
        .from("coworker_tasks")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

    if (existingError || !existing) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    const history = Array.isArray(existing.history) ? [...existing.history] : [];
    const now = new Date().toISOString();

    if (body.status !== undefined) {
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
        const priorityRaw = String(body.priority || "").trim();
        if (!isValidPriority(priorityRaw)) {
            return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
        }
        patch.priority = priorityRaw;
        history.push({ at: now, action: "priority_updated", priority: priorityRaw });
    }

    if (body.assigned_agent !== undefined) {
        const assignedAgent = String(body.assigned_agent || "").trim();
        patch.assigned_agent = assignedAgent || null;
        history.push({ at: now, action: "agent_assigned", assigned_agent: assignedAgent || null });
    }

    if (body.result_summary !== undefined) {
        const resultSummary = String(body.result_summary || "").trim();
        if (resultSummary.length > 8000) {
            return NextResponse.json({ error: "Result summary too long" }, { status: 400 });
        }
        patch.result_summary = resultSummary || null;
        history.push({ at: now, action: "result_updated" });
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
        return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
    }

    return NextResponse.json({ task: data });
}
