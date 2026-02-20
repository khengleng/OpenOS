import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/rbac";

type CoworkerTaskRecord = {
    id: string;
    title: string;
    description?: string | null;
    status: string;
    priority: string;
    assigned_agent?: string | null;
    result_summary?: string | null;
    history?: unknown[];
    created_at: string;
    updated_at: string;
    started_at?: string | null;
    completed_at?: string | null;
};

function isMissingCoworkerTableError(error: unknown): boolean {
    const code = typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code || "")
        : "";
    const message = typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message || "")
        : "";
    return code === "42P01" || /coworker_tasks/i.test(message);
}

function latestApprovalState(history: unknown[]): "none" | "pending" | "approved" | "rejected" {
    for (let i = history.length - 1; i >= 0; i -= 1) {
        const entry = history[i];
        if (!entry || typeof entry !== "object") continue;
        const action = String((entry as { action?: unknown }).action || "");
        if (action === "approval_requested") return "pending";
        if (action === "approval_approved") return "approved";
        if (action === "approval_rejected") return "rejected";
    }
    return "none";
}

function latestSimulationId(history: unknown[]): string {
    for (let i = history.length - 1; i >= 0; i -= 1) {
        const entry = history[i];
        if (!entry || typeof entry !== "object") continue;
        const simulationId = String((entry as { simulation_id?: unknown }).simulation_id || "");
        if (simulationId) return simulationId;
    }
    return "";
}

function csvEscape(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

function toCsv(tasks: CoworkerTaskRecord[]): string {
    const header = [
        "id",
        "title",
        "status",
        "priority",
        "assigned_agent",
        "approval_state",
        "latest_simulation_id",
        "created_at",
        "updated_at",
        "started_at",
        "completed_at",
        "result_summary",
    ];
    const rows = tasks.map((task) => {
        const history = Array.isArray(task.history) ? task.history : [];
        const approval = latestApprovalState(history);
        const simId = latestSimulationId(history);
        const columns = [
            task.id,
            task.title || "",
            task.status || "",
            task.priority || "",
            task.assigned_agent || "",
            approval,
            simId,
            task.created_at || "",
            task.updated_at || "",
            task.started_at || "",
            task.completed_at || "",
            task.result_summary || "",
        ];
        return columns.map((col) => csvEscape(String(col))).join(",");
    });
    return [header.join(","), ...rows].join("\n");
}

export async function GET(request: NextRequest) {
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

    const { data, error } = await supabase
        .from("coworker_tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    if (error) {
        if (isMissingCoworkerTableError(error)) {
            return NextResponse.json(
                { error: "Coworker task table not found. Run Supabase schema migration first." },
                { status: 503 },
            );
        }
        return NextResponse.json({ error: "Failed to export tasks" }, { status: 500 });
    }

    const tasks = (data || []) as CoworkerTaskRecord[];
    const format = String(request.nextUrl.searchParams.get("format") || "json").toLowerCase();

    if (format === "csv") {
        const csv = toCsv(tasks);
        return new NextResponse(csv, {
            status: 200,
            headers: {
                "content-type": "text/csv; charset=utf-8",
                "content-disposition": `attachment; filename="coworker_tasks_${new Date().toISOString().slice(0, 10)}.csv"`,
            },
        });
    }

    return NextResponse.json({
        exported_at: new Date().toISOString(),
        count: tasks.length,
        tasks,
    });
}
