import { NextRequest, NextResponse } from "next/server";

const CLAWWORK_INTERNAL_URL =
    process.env.CLAWWORK_INTERNAL_URL || process.env.NEXT_PUBLIC_CLAWWORK_API_URL;
const CLAWWORK_API_TOKEN = process.env.CLAWWORK_API_TOKEN;

function buildUpstreamUrl(pathname: string): URL {
    if (!CLAWWORK_INTERNAL_URL) {
        throw new Error("Missing CLAWWORK_INTERNAL_URL or NEXT_PUBLIC_CLAWWORK_API_URL");
    }
    return new URL(pathname, CLAWWORK_INTERNAL_URL);
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
        if (CLAWWORK_API_TOKEN) {
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
        const responseHeaders = new Headers();
        const upstreamContentType = upstreamResponse.headers.get("content-type");
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
