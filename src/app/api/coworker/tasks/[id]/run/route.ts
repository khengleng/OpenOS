import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole, hasRole } from "@/lib/rbac";
import { DEFAULT_WORKSPACE_MODEL } from "@/lib/model-options";

type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
type LaunchAuthMode = "jwt" | "token" | "none";
const RETRYABLE_LAUNCH_STATUSES = new Set([404, 502, 503, 504]);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

function getRawClawworkBaseUrl(): string {
    return (process.env.CLAWWORK_INTERNAL_URL || process.env.NEXT_PUBLIC_CLAWWORK_API_URL || "").trim();
}

function normalizeBaseUrl(raw: string): string {
    if (!raw) return "";
    const unquoted = raw.replace(/^['"]|['"]$/g, "");
    if (/^https?:\/\//i.test(unquoted)) return unquoted;
    return `https://${unquoted}`;
}

async function generateTenantJwt(tenantId: string): Promise<string> {
    const secret = process.env.CLAWWORK_JWT_SECRET;
    if (!secret) return "";

    const issuer = (process.env.CLAWWORK_JWT_ISSUER || "").trim();
    const audience = (process.env.CLAWWORK_JWT_AUDIENCE || "").trim();
    const algs = (process.env.CLAWWORK_JWT_ALGORITHMS || "HS256")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    const alg = algs[0] || "HS256";

    let token = new SignJWT({ tenant_id: tenantId }).setProtectedHeader({ alg });
    if (issuer) token = token.setIssuer(issuer);
    if (audience) token = token.setAudience(audience);
    return token.setIssuedAt().setExpirationTime("10m").sign(new TextEncoder().encode(secret));
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

    const role = await getCurrentUserRole(user.id);
    if (!hasRole(role, ["maker", "admin"])) {
        return NextResponse.json({ error: "Only maker or admin can run coworker tasks" }, { status: 403 });
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
    const requestedModel = String(body.model || "").trim();
    const requestedMaxStepsRaw = Number(body.max_steps);
    const requestedMaxRetriesRaw = Number(body.max_retries);
    const requestedMaxSteps = Number.isFinite(requestedMaxStepsRaw)
        ? Math.max(1, Math.min(60, Math.floor(requestedMaxStepsRaw)))
        : null;
    const requestedMaxRetries = Number.isFinite(requestedMaxRetriesRaw)
        ? Math.max(0, Math.min(10, Math.floor(requestedMaxRetriesRaw)))
        : null;

    const now = new Date().toISOString();
    const signature = String(existing.assigned_agent || "").trim() || `task-${id.slice(0, 8)}`;
    const history = Array.isArray(existing.history) ? [...existing.history] : [];
    const approvalState = latestApprovalState(history);
    if (approvalState === "pending") {
        return NextResponse.json(
            { error: "Task is waiting for approval. Approve or reject it before running." },
            { status: 409 },
        );
    }
    const prompt = buildInlinePrompt(String(existing.title || "Untitled task"), existing.description);
    const userMetadata = (user.user_metadata || {}) as Record<string, unknown>;
    const defaultModel = String(userMetadata.workspace_default_model || DEFAULT_WORKSPACE_MODEL).trim() || DEFAULT_WORKSPACE_MODEL;
    const model = requestedModel || defaultModel;

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
                max_steps: requestedMaxSteps ?? 20,
                max_retries: requestedMaxRetries ?? 2,
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

    const clawworkBase = normalizeBaseUrl(getRawClawworkBaseUrl());
    if (!clawworkBase) {
        return NextResponse.json(
            { error: "Missing CLAWWORK_INTERNAL_URL or NEXT_PUBLIC_CLAWWORK_API_URL" },
            { status: 500 },
        );
    }

    let launchPayload: unknown = null;
    try {
        const url = new URL("/api/simulations", clawworkBase);
        const headers = new Headers({ "content-type": "application/json", "x-tenant-id": user.id });
        const apiToken = (process.env.CLAWWORK_API_TOKEN || "").trim();

        const applyLaunchAuth = async (preferredMode: LaunchAuthMode): Promise<LaunchAuthMode> => {
            headers.delete("authorization");
            if (preferredMode === "jwt") {
                const jwt = await generateTenantJwt(user.id);
                if (jwt) {
                    headers.set("authorization", `Bearer ${jwt}`);
                    return "jwt";
                }
            }
            if (apiToken) {
                headers.set("authorization", `Bearer ${apiToken}`);
                return "token";
            }
            return "none";
        };

        const sendLaunch = async () =>
            fetch(url, {
                method: "POST",
                headers,
                body: JSON.stringify({ config }),
                cache: "no-store",
            });

        const sendLaunchWithRetry = async () => {
            let response = await sendLaunch();
            if (RETRYABLE_LAUNCH_STATUSES.has(response.status)) {
                await sleep(250);
                response = await sendLaunch();
            }
            return response;
        };

        let authMode = await applyLaunchAuth("jwt");
        let launchResponse = await sendLaunchWithRetry();
        if (
            authMode === "jwt"
            && apiToken
            && (launchResponse.status === 401 || launchResponse.status === 403)
        ) {
            authMode = await applyLaunchAuth("token");
            launchResponse = await sendLaunchWithRetry();
        }

        const launchText = await launchResponse.text();
        try {
            launchPayload = launchText ? JSON.parse(launchText) : {};
        } catch {
            launchPayload = { detail: launchText };
        }

        if ((launchResponse.status === 401 || launchResponse.status === 403) && authMode === "none") {
            return NextResponse.json(
                {
                    error: "ClawWork auth misconfigured",
                    detail:
                        "No CLAWWORK_JWT_SECRET or CLAWWORK_API_TOKEN configured in OpenOS service for task runs.",
                },
                { status: 500 },
            );
        }

        if (!launchResponse.ok) {
            const contentType = launchResponse.headers.get("content-type") || "";
            if (launchResponse.status === 404 && contentType.includes("text/html")) {
                return NextResponse.json(
                    {
                        error: "ClawWork upstream misconfigured",
                        detail:
                            "Received HTML 404 from upstream. Check CLAWWORK_INTERNAL_URL/NEXT_PUBLIC_CLAWWORK_API_URL points to ClawWork API service.",
                    },
                    { status: 502 },
                );
            }
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
        run_config: {
            max_steps: requestedMaxSteps ?? 20,
            max_retries: requestedMaxRetries ?? 2,
        },
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
