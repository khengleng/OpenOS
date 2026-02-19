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

export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
        .from("coworker_tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    if (error) {
        return NextResponse.json({ error: "Failed to load tasks" }, { status: 500 });
    }

    return NextResponse.json({ tasks: data || [] });
}

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const assignedAgent = String(body.assigned_agent || "").trim();
    const statusRaw = String(body.status || "todo").trim();
    const priorityRaw = String(body.priority || "medium").trim();

    if (!title || title.length > 180) {
        return NextResponse.json({ error: "Invalid title" }, { status: 400 });
    }
    if (description.length > 5000) {
        return NextResponse.json({ error: "Description too long" }, { status: 400 });
    }
    if (!isValidStatus(statusRaw)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    if (!isValidPriority(priorityRaw)) {
        return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const historyEntry = {
        at: now,
        action: "created",
        status: statusRaw,
    };

    const payload = {
        user_id: user.id,
        title,
        description: description || null,
        status: statusRaw,
        priority: priorityRaw,
        assigned_agent: assignedAgent || null,
        history: [historyEntry],
        started_at: statusRaw === "in_progress" ? now : null,
        completed_at: statusRaw === "done" ? now : null,
        updated_at: now,
    };

    const { data, error } = await supabase
        .from("coworker_tasks")
        .insert(payload)
        .select("*")
        .single();

    if (error) {
        return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
    }

    return NextResponse.json({ task: data });
}
