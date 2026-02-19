import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

function isMissingCoworkerTableError(error: unknown): boolean {
    const code = typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code || "")
        : "";
    const message = typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message || "")
        : "";
    return code === "42P01" || /coworker_tasks/i.test(message);
}

function buildInlinePrompt(title: string, description?: string | null): string {
    const trimmedDescription = (description || "").trim();
    if (!trimmedDescription) {
        return `Complete this task clearly and concisely:\n\n${title}`;
    }
    return `Complete this task clearly and concisely:\n\nTitle: ${title}\n\nDetails:\n${trimmedDescription}`;
}

function parseSimulationId(payload: unknown): string {
    if (!payload || typeof payload !== "object") return "";
    const raw = (payload as { simulation_id?: unknown; id?: unknown }).simulation_id
        ?? (payload as { id?: unknown }).id;
    return typeof raw === "string" ? raw : "";
}

export async function POST(
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
        if (isMissingCoworkerTableError(existingError)) {
            return NextResponse.json(
                { error: "Coworker task table not found. Run Supabase schema migration first." },
                { status: 503 },
            );
        }
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const signature = String(existing.assigned_agent || "").trim() || `task-${id.slice(0, 8)}`;
    const history = Array.isArray(existing.history) ? [...existing.history] : [];
    const prompt = buildInlinePrompt(String(existing.title || "Untitled task"), existing.description);
    const model = "gpt-4o";

    const config = {
        livebench: {
            date_range: {
                init_date: now.split("T")[0],
                end_date: new Date(Date.now() + (3 * 24 * 60 * 60 * 1000)).toISOString().split("T")[0],
            },
            economic: {
                initial_balance: 10,
                spend_cap_daily_usd: 25,
                spend_cap_monthly_usd: 200,
                token_pricing: {
                    input_per_1m: 2.5,
                    output_per_1m: 10.0,
                },
            },
            task_source: {
                type: "inline",
                tasks: [
                    {
                        task_id: `coworker-${id}`,
                        sector: "General",
                        occupation: "AI Coworker",
                        prompt,
                        reference_files: [],
                    },
                ],
            },
            agents: [
                {
                    signature,
                    basemodel: model,
                    enabled: true,
                    tasks_per_day: 1,
                    supports_multimodal: true,
                },
            ],
            agent_params: {
                max_steps: 20,
                max_retries: 2,
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

    let launchPayload: unknown = null;
    try {
        const launchResponse = await fetch(`${request.nextUrl.origin}/api/clawwork/simulations`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                cookie: request.headers.get("cookie") || "",
            },
            body: JSON.stringify({ config }),
            cache: "no-store",
        });
        const launchText = await launchResponse.text();
        try {
            launchPayload = launchText ? JSON.parse(launchText) : {};
        } catch {
            launchPayload = { detail: launchText };
        }

        if (!launchResponse.ok) {
            const detail = typeof launchPayload === "object" && launchPayload !== null
                ? String(
                    (launchPayload as { detail?: unknown; error?: unknown }).detail
                    || (launchPayload as { detail?: unknown; error?: unknown }).error
                    || launchText
                    || `Launch failed (${launchResponse.status})`,
                )
                : launchText || `Launch failed (${launchResponse.status})`;
            return NextResponse.json({ error: detail }, { status: launchResponse.status });
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to launch coworker task";
        return NextResponse.json({ error: message }, { status: 502 });
    }

    const simulationId = parseSimulationId(launchPayload);
    history.push({
        at: now,
        action: "simulation_started",
        simulation_id: simulationId || null,
        signature,
        model,
    });

    const patch: {
        assigned_agent: string;
        status: TaskStatus;
        started_at: string | null;
        completed_at: null;
        updated_at: string;
        history: unknown[];
        result_summary: string;
    } = {
        assigned_agent: signature,
        status: "in_progress",
        started_at: existing.started_at || now,
        completed_at: null,
        updated_at: now,
        history,
        result_summary: simulationId
            ? `Simulation started: ${simulationId}`
            : "Simulation started",
    };

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
        return NextResponse.json({ error: "Failed to update task after launch" }, { status: 500 });
    }

    return NextResponse.json({
        task: data,
        simulation_id: simulationId || null,
        launch: launchPayload,
    });
}
