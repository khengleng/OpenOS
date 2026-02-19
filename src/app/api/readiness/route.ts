import { NextResponse } from "next/server";

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
    "CLAWWORK_API_TOKEN",
];

async function checkClawworkReachability() {
    const clawworkUrl = getClawworkBaseUrl();
    if (!clawworkUrl) {
        return { ok: false, error: "Missing CLAWWORK_INTERNAL_URL or NEXT_PUBLIC_CLAWWORK_API_URL" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
        const healthUrl = new URL("/", clawworkUrl);
        const response = await fetch(healthUrl, {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
        });
        return { ok: response.ok, status: response.status };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
    } finally {
        clearTimeout(timeout);
    }
}

export async function GET() {
    const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
    if (!getClawworkBaseUrl()) {
        missing.push("CLAWWORK_INTERNAL_URL|NEXT_PUBLIC_CLAWWORK_API_URL");
    }
    const clawwork = await checkClawworkReachability();
    const ready = missing.length === 0 && clawwork.ok;

    return NextResponse.json(
        {
            service: "openos-web",
            ready,
            missing_env: missing,
            clawwork,
            ts: new Date().toISOString(),
        },
        { status: ready ? 200 : 503 },
    );
}
