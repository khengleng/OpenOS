import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

type RateLimitBucket = {
    count: number;
    resetAtMs: number;
};

type RateLimitResult = {
    allowed: boolean;
    remaining: number;
    retryAfterSec: number;
};

const buckets = new Map<string, RateLimitBucket>();

const RATE_LIMIT_WINDOW_SEC = Number(process.env.CLAWWORK_PROXY_RATE_LIMIT_WINDOW_SEC || "60");
const READ_RATE_LIMIT = Number(process.env.CLAWWORK_PROXY_READ_RATE_LIMIT || "120");
const WRITE_RATE_LIMIT = Number(process.env.CLAWWORK_PROXY_WRITE_RATE_LIMIT || "30");

function nowMs() {
    return Date.now();
}

export function getClientIp(request: NextRequest): string {
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
        return forwardedFor.split(",")[0].trim();
    }
    const realIp = request.headers.get("x-real-ip");
    return realIp?.trim() || "unknown";
}

export function applyRateLimit(key: string, maxRequests: number): RateLimitResult {
    const windowMs = Math.max(1, RATE_LIMIT_WINDOW_SEC) * 1000;
    const currentTime = nowMs();
    const existing = buckets.get(key);

    if (!existing || currentTime > existing.resetAtMs) {
        buckets.set(key, { count: 1, resetAtMs: currentTime + windowMs });
        return { allowed: true, remaining: Math.max(0, maxRequests - 1), retryAfterSec: 0 };
    }

    if (existing.count >= maxRequests) {
        const retryAfterSec = Math.max(1, Math.ceil((existing.resetAtMs - currentTime) / 1000));
        return { allowed: false, remaining: 0, retryAfterSec };
    }

    existing.count += 1;
    buckets.set(key, existing);
    return { allowed: true, remaining: Math.max(0, maxRequests - existing.count), retryAfterSec: 0 };
}

export function checkClawworkRateLimit(
    request: NextRequest,
    routeKey: string,
    kind: "read" | "write",
): NextResponse | null {
    const ip = getClientIp(request);
    const limit = kind === "write" ? WRITE_RATE_LIMIT : READ_RATE_LIMIT;
    const result = applyRateLimit(`${kind}:${routeKey}:${ip}`, limit);
    if (result.allowed) {
        return null;
    }
    return NextResponse.json(
        { error: "Too many requests. Please retry later." },
        {
            status: 429,
            headers: { "Retry-After": String(result.retryAfterSec) },
        },
    );
}

type AuditEvent = {
    action: string;
    status: "allowed" | "denied" | "rate_limited" | "upstream_error";
    request: NextRequest;
    userId?: string | null;
    details?: Record<string, unknown>;
};

export function logApiAuditEvent(event: AuditEvent) {
    const ip = getClientIp(event.request);
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);

    console.info(
        JSON.stringify({
            type: "audit",
            source: "openos-clawwork-proxy",
            ts: new Date().toISOString(),
            action: event.action,
            status: event.status,
            method: event.request.method,
            path: event.request.nextUrl.pathname,
            ip_hash: ipHash,
            user_id: event.userId ?? null,
            details: event.details ?? {},
        }),
    );
}
