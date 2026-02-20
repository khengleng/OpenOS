import { createHash, createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/route-auth";
import { createAdminClient } from "@/lib/supabase/admin";

type MetricInput = {
    date?: string;
    metric_date?: string;
    steps?: number;
    active_calories?: number;
    resting_heart_rate?: number;
    sleep_hours?: number;
    source?: string;
    raw_payload?: unknown;
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

function normalizeMetric(input: MetricInput): Record<string, unknown> | null {
    const dateRaw = String(input.metric_date || input.date || "").trim();
    if (!dateRaw) return null;
    const date = new Date(dateRaw);
    if (Number.isNaN(date.getTime())) return null;
    const metricDate = date.toISOString().slice(0, 10);

    const steps = Number(input.steps || 0);
    const activeCalories = input.active_calories === undefined ? null : Number(input.active_calories);
    const restingHeartRate = input.resting_heart_rate === undefined ? null : Number(input.resting_heart_rate);
    const sleepHours = input.sleep_hours === undefined ? null : Number(input.sleep_hours);

    return {
        metric_date: metricDate,
        steps: Number.isFinite(steps) ? Math.max(0, Math.floor(steps)) : 0,
        active_calories: Number.isFinite(activeCalories as number) ? Number(activeCalories) : null,
        resting_heart_rate: Number.isFinite(restingHeartRate as number) ? Number(restingHeartRate) : null,
        sleep_hours: Number.isFinite(sleepHours as number) ? Number(sleepHours) : null,
        source: String(input.source || "apple-health").slice(0, 100),
        raw_payload: input.raw_payload ?? null,
        updated_at: new Date().toISOString(),
    };
}

async function resolveUserFromIngestKey(ingestKey: string): Promise<string | null> {
    const admin = createAdminClient();
    if (!admin) return null;
    const tokenHash = hashIngestKey(ingestKey);
    const { data, error } = await admin
        .from("apple_health_connections")
        .select("user_id, enabled")
        .eq("ingest_key_hash", tokenHash)
        .maybeSingle();

    if (error || !data) return null;
    if (!data.enabled) return null;
    return String(data.user_id || "") || null;
}

function verifySignedPayload(
    ingestKey: string,
    timestamp: string,
    payloadText: string,
    signatureHex: string,
): boolean {
    if (!timestamp || !signatureHex) return false;
    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) return false;
    const ageMs = Math.abs(Date.now() - ts);
    if (ageMs > 5 * 60 * 1000) return false;

    const expected = createHmac("sha256", ingestKey)
        .update(`${timestamp}.${payloadText}`)
        .digest("hex");
    if (expected.length !== signatureHex.length) return false;
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signatureHex, "hex"));
}

export async function POST(request: NextRequest) {
    const authUserId = await getAuthenticatedUserId();
    let userId = authUserId;
    let ingestMode: "session" | "signed_key" = authUserId ? "session" : "signed_key";
    let ingestKey = "";

    if (!userId) {
        const bearer = String(request.headers.get("authorization") || "").trim();
        const bearerToken = bearer.toLowerCase().startsWith("bearer ") ? bearer.slice(7).trim() : "";
        const headerToken = String(request.headers.get("x-apple-sync-key") || "").trim();
        ingestKey = headerToken || bearerToken;
        if (!ingestKey) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        userId = await resolveUserFromIngestKey(ingestKey);
        if (!userId) {
            return NextResponse.json({ error: "Invalid Apple Health sync key" }, { status: 401 });
        }
    }

    const payloadText = await request.text();
    let body: Record<string, unknown> = {};
    try {
        body = (payloadText ? JSON.parse(payloadText) : {}) as Record<string, unknown>;
    } catch {
        return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }
    if (ingestMode === "signed_key") {
        const signature = String(request.headers.get("x-apple-sync-signature") || "").trim().toLowerCase();
        const timestamp = String(request.headers.get("x-apple-sync-ts") || "").trim();
        if (!verifySignedPayload(ingestKey, timestamp, payloadText, signature)) {
            return NextResponse.json({ error: "Invalid sync request signature" }, { status: 401 });
        }
    }

    const inputs = Array.isArray(body.metrics)
        ? (body.metrics as MetricInput[])
        : [body as MetricInput];

    if (inputs.length === 0 || inputs.length > 31) {
        return NextResponse.json({ error: "Provide between 1 and 31 metrics per request" }, { status: 400 });
    }

    const rows = inputs
        .map((item) => normalizeMetric(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item) => ({ ...item, user_id: userId }));

    if (rows.length === 0) {
        return NextResponse.json({ error: "No valid metric payloads found" }, { status: 400 });
    }

    const supabase = ingestMode === "session" ? await createClient() : createAdminClient();
    if (!supabase) {
        return NextResponse.json(
            { error: "Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is required for signed sync ingestion." },
            { status: 500 },
        );
    }

    const { error } = await supabase
        .from("apple_health_daily_metrics")
        .upsert(rows, { onConflict: "user_id,metric_date" });

    if (error) {
        if (isMissingAppleHealthTableError(error)) {
            return NextResponse.json(
                { error: "Apple Health schema missing. Run Supabase migration first." },
                { status: 503 },
            );
        }
        return NextResponse.json({ error: "Failed to ingest Apple Health metrics" }, { status: 500 });
    }

    await supabase
        .from("apple_health_connections")
        .upsert(
            { user_id: userId, enabled: true, last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { onConflict: "user_id" },
        );

    return NextResponse.json({
        status: "ok",
        ingested: rows.length,
        user_id: userId,
        mode: ingestMode,
    });
}
