import { NextRequest } from "next/server";
import { proxyClawworkRequest } from "@/lib/clawwork-proxy";
import { getAuthenticatedUserId, unauthorizedResponse } from "@/lib/route-auth";
import { checkClawworkRateLimit, logApiAuditEvent } from "@/lib/api-security";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ signature: string }> },
) {
    const limited = checkClawworkRateLimit(request, "agents.detail", "read");
    if (limited) {
        logApiAuditEvent({ action: "clawwork.agents.detail", status: "rate_limited", request });
        return limited;
    }

    const userId = await getAuthenticatedUserId();
    if (!userId) {
        logApiAuditEvent({ action: "clawwork.agents.detail", status: "denied", request });
        return unauthorizedResponse();
    }

    const { signature } = await params;
    const response = await proxyClawworkRequest(
        request,
        `/api/agents/${encodeURIComponent(signature)}`,
        userId,
    );
    logApiAuditEvent({
        action: "clawwork.agents.detail",
        status: response.ok ? "allowed" : "upstream_error",
        request,
        userId,
        details: { upstream_status: response.status, signature },
    });
    return response;
}
