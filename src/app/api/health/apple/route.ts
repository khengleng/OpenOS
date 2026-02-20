import { randomBytes, createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId, unauthorizedResponse } from "@/lib/route-auth";
import { createClient } from "@/lib/supabase/server";

type ConnectionRecord = {
    user_id: string;
    key_last4: string;
    enabled: boolean;
    last_sync_at?: string | null;
    updated_at?: string;
};

type DailyMetric = {
    metric_date: string;
    steps: number;
    active_calories?: number | null;
    resting_heart_rate?: number | null;
    sleep_hours?: number | null;
    source?: string;
    updated_at?: string;
};

function hashIngestKey(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

function isMissingAppleHealthTableError(error: unknown): boolean {
    const code = typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code || "")
        : "";
    const message = typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message || "")
        : "";
    return code === "42P01" || /apple_health_/i.test(message);
}

export async function GET() {
    const userId = await getAuthenticatedUserId();
    if (!userId) return unauthorizedResponse();

    const supabase = await createClient();
    const { data: connection, error: connectionError } = await supabase
        .from("apple_health_connections")
        .select("user_id, key_last4, enabled, last_sync_at, updated_at")
        .eq("user_id", userId)
        .maybeSingle();

    if (connectionError) {
        if (isMissingAppleHealthTableError(connectionError)) {
            return NextResponse.json(
                { error: "Apple Health schema missing. Run Supabase migration first." },
                { status: 503 },
            );
        }
        return NextResponse.json({ error: "Failed to load Apple Health connection" }, { status: 500 });
    }

    const { data: metrics, error: metricsError } = await supabase
        .from("apple_health_daily_metrics")
        .select("metric_date, steps, active_calories, resting_heart_rate, sleep_hours, source, updated_at")
        .eq("user_id", userId)
        .order("metric_date", { ascending: false })
        .limit(14);

    if (metricsError) {
        if (isMissingAppleHealthTableError(metricsError)) {
            return NextResponse.json(
                { error: "Apple Health schema missing. Run Supabase migration first." },
                { status: 503 },
            );
        }
        return NextResponse.json({ error: "Failed to load Apple Health metrics" }, { status: 500 });
    }

    const metricRows = (metrics || []) as DailyMetric[];
    const todayKey = new Date().toISOString().slice(0, 10);
    const today = metricRows.find((row) => String(row.metric_date) === todayKey) || null;

    return NextResponse.json({
        connected: Boolean(connection?.enabled),
        connection: connection ? (connection as ConnectionRecord) : null,
        today,
        metrics: metricRows,
    });
}

export async function POST(request: NextRequest) {
    const userId = await getAuthenticatedUserId();
    if (!userId) return unauthorizedResponse();

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action || "rotate_key").trim().toLowerCase();

    const supabase = await createClient();

    if (action === "disable") {
        const { error } = await supabase
            .from("apple_health_connections")
            .upsert({ user_id: userId, enabled: false, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

        if (error) {
            if (isMissingAppleHealthTableError(error)) {
                return NextResponse.json(
                    { error: "Apple Health schema missing. Run Supabase migration first." },
                    { status: 503 },
                );
            }
            return NextResponse.json({ error: "Failed to disable Apple Health sync" }, { status: 500 });
        }

        return NextResponse.json({ message: "Apple Health sync disabled" });
    }

    const token = `ahs_${randomBytes(24).toString("hex")}`;
    const tokenHash = hashIngestKey(token);
    const keyLast4 = token.slice(-4);

    const { data, error } = await supabase
        .from("apple_health_connections")
        .upsert(
            {
                user_id: userId,
                ingest_key_hash: tokenHash,
                key_last4: keyLast4,
                enabled: true,
                updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
        )
        .select("user_id, key_last4, enabled, last_sync_at, updated_at")
        .single();

    if (error) {
        if (isMissingAppleHealthTableError(error)) {
            return NextResponse.json(
                { error: "Apple Health schema missing. Run Supabase migration first." },
                { status: 503 },
            );
        }
        return NextResponse.json({ error: "Failed to rotate Apple Health sync key" }, { status: 500 });
    }

    return NextResponse.json({
        message: "Apple Health sync key rotated.",
        sync_key: token,
        connection: data,
    });
}
