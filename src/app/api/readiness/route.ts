import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function normalizeBaseUrl(raw: string): string {
    const value = (raw || "").trim();
    if (!value) return "";
    const unquoted = value.replace(/^['"]|['"]$/g, "");
    if (/^https?:\/\//i.test(unquoted)) return unquoted;
    return `https://${unquoted}`;
}

function getClawworkBaseUrl(): string {
    return normalizeBaseUrl(process.env.CLAWWORK_INTERNAL_URL || process.env.NEXT_PUBLIC_CLAWWORK_API_URL || "");
}

const REQUIRED_ENV_VARS = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "CLAWWORK_JWT_SECRET",
];

type TableCheck = {
    table: string;
    exists: boolean;
    error?: string;
};

async function checkClawworkReachability() {
    const clawworkUrl = getClawworkBaseUrl();
    if (!clawworkUrl) {
        return { ok: false, error: "Missing CLAWWORK_INTERNAL_URL or NEXT_PUBLIC_CLAWWORK_API_URL" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
        const healthzUrl = new URL("/healthz", clawworkUrl);
        const healthz = await fetch(healthzUrl, {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
        });
        if (healthz.ok) {
            return { ok: true, status: healthz.status, endpoint: "/healthz" };
        }

        const readyzUrl = new URL("/readyz", clawworkUrl);
        const readyz = await fetch(readyzUrl, {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
        });
        return { ok: readyz.ok, status: readyz.status, endpoint: "/readyz" };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
    } finally {
        clearTimeout(timeout);
    }
}

async function checkDatabaseMigrations() {
    const admin = createAdminClient();
    if (!admin) {
        return {
            ok: false,
            checks: [] as TableCheck[],
            error: "Missing Supabase admin client configuration",
        };
    }

    const tables = [
        "user_roles",
        "coworker_tasks",
        "apple_health_connections",
        "apple_health_daily_metrics",
    ] as const;

    const checks: TableCheck[] = [];
    for (const table of tables) {
        const { error } = await admin
            .from(table)
            .select("*", { head: true, count: "exact" });

        if (!error) {
            checks.push({ table, exists: true });
            continue;
        }

        const code = String((error as { code?: string }).code || "");
        const message = String((error as { message?: string }).message || "");
        if (code === "42P01" || /relation .* does not exist/i.test(message)) {
            checks.push({ table, exists: false, error: "missing_table" });
        } else {
            checks.push({ table, exists: false, error: message || code || "unknown_error" });
        }
    }

    return {
        ok: checks.every((check) => check.exists),
        checks,
    };
}

export async function GET() {
    const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
    if (!getClawworkBaseUrl()) {
        missing.push("CLAWWORK_INTERNAL_URL|NEXT_PUBLIC_CLAWWORK_API_URL");
    }
    const clawwork = await checkClawworkReachability();
    const database = await checkDatabaseMigrations();
    const ready = missing.length === 0 && clawwork.ok && database.ok;

    return NextResponse.json(
        {
            service: "openos-web",
            ready,
            missing_env: missing,
            clawwork,
            database,
            ts: new Date().toISOString(),
        },
        { status: ready ? 200 : 503 },
    );
}
