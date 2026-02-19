import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";

function getRawClawworkBaseUrl(): string {
    return (process.env.CLAWWORK_INTERNAL_URL || process.env.NEXT_PUBLIC_CLAWWORK_API_URL || "").trim();
}

function normalizeBaseUrl(raw: string): string {
    if (!raw) return "";
    const unquoted = raw.replace(/^['"]|['"]$/g, "");
    if (/^https?:\/\//i.test(unquoted)) return unquoted;
    return `https://${unquoted}`;
}

const CLAWWORK_INTERNAL_URL = normalizeBaseUrl(getRawClawworkBaseUrl());
const CLAWWORK_API_TOKEN = process.env.CLAWWORK_API_TOKEN;
const CLAWWORK_JWT_SECRET = process.env.CLAWWORK_JWT_SECRET;
const CLAWWORK_JWT_ISSUER = (process.env.CLAWWORK_JWT_ISSUER || "").trim();
const CLAWWORK_JWT_AUDIENCE = (process.env.CLAWWORK_JWT_AUDIENCE || "").trim();
const CLAWWORK_JWT_ALGORITHMS = (process.env.CLAWWORK_JWT_ALGORITHMS || "HS256")
    .split(",")
    .map((alg) => alg.trim())
    .filter(Boolean);
const CLAWWORK_JWT_SIGNING_ALG = CLAWWORK_JWT_ALGORITHMS[0] || "HS256";

async function generateClawworkJwt(tenantId: string): Promise<string> {
    if (!CLAWWORK_JWT_SECRET) return "";

    const secret = new TextEncoder().encode(CLAWWORK_JWT_SECRET);
    // Sign a fresh token for this request sequence.
    let tokenBuilder = new SignJWT({ tenant_id: tenantId }).setProtectedHeader({ alg: CLAWWORK_JWT_SIGNING_ALG });
    if (CLAWWORK_JWT_ISSUER) tokenBuilder = tokenBuilder.setIssuer(CLAWWORK_JWT_ISSUER);
    if (CLAWWORK_JWT_AUDIENCE) tokenBuilder = tokenBuilder.setAudience(CLAWWORK_JWT_AUDIENCE);
    return await tokenBuilder
        .setIssuedAt()
        .setExpirationTime("10m") // Short lived token for single request proxying
        .sign(secret);
}

function buildUpstreamUrl(pathname: string): URL {
    if (!CLAWWORK_INTERNAL_URL) {
        throw new Error("Missing CLAWWORK_INTERNAL_URL or NEXT_PUBLIC_CLAWWORK_API_URL");
    }
    try {
        return new URL(pathname, CLAWWORK_INTERNAL_URL);
    } catch {
        throw new Error("Invalid ClawWork base URL. Expected full URL like https://example.up.railway.app");
    }
}

export async function proxyClawworkRequest(
    request: NextRequest,
    pathname: string,
    tenantId?: string,
): Promise<NextResponse> {
    try {
        const upstreamUrl = buildUpstreamUrl(pathname);
        upstreamUrl.search = request.nextUrl.search;

        const headers = new Headers();
        const contentType = request.headers.get("content-type");
        if (contentType) {
            headers.set("content-type", contentType);
        }

        // Tenant-scoped auth requires JWT in production-secure ClawWork deployments.
        if (tenantId && !CLAWWORK_JWT_SECRET) {
            return NextResponse.json(
                {
                    error: "ClawWork auth misconfigured",
                    detail:
                        "Missing CLAWWORK_JWT_SECRET in OpenOS service. Set the same JWT secret in OpenOS and ClawWork.",
                },
                { status: 500 },
            );
        }

        if (tenantId && CLAWWORK_JWT_SECRET) {
            const jwt = await generateClawworkJwt(tenantId);
            headers.set("authorization", `Bearer ${jwt}`);
        } else if (CLAWWORK_API_TOKEN) {
            headers.set("authorization", `Bearer ${CLAWWORK_API_TOKEN}`);
        }

        if (tenantId) {
            headers.set("x-tenant-id", tenantId);
        }

        const method = request.method.toUpperCase();
        const body = method === "GET" || method === "HEAD" ? undefined : await request.text();

        const upstreamResponse = await fetch(upstreamUrl, {
            method,
            headers,
            body,
            cache: "no-store",
        });

        const responseBody = await upstreamResponse.text();
        const upstreamContentType = upstreamResponse.headers.get("content-type") || "";
        const isHtmlNotFound = upstreamResponse.status === 404 && upstreamContentType.includes("text/html");
        if (isHtmlNotFound) {
            return NextResponse.json(
                {
                    error: "ClawWork upstream misconfigured",
                    detail:
                        "Received HTML 404 from upstream. Check NEXT_PUBLIC_CLAWWORK_API_URL/CLAWWORK_INTERNAL_URL points to ClawWork API service, not OpenOS/frontend.",
                },
                { status: 502 },
            );
        }

        const responseHeaders = new Headers();
        if (upstreamContentType) {
            responseHeaders.set("content-type", upstreamContentType);
        }

        return new NextResponse(responseBody, {
            status: upstreamResponse.status,
            headers: responseHeaders,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown ClawWork proxy error";
        return NextResponse.json(
            {
                error: "ClawWork upstream unavailable",
                detail: message,
            },
            { status: 502 },
        );
    }
}
