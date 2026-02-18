import { NextRequest } from "next/server";
import { proxyClawworkRequest } from "@/lib/clawwork-proxy";
import { getAuthenticatedUserId, unauthorizedResponse } from "@/lib/route-auth";
import { checkClawworkRateLimit, logApiAuditEvent } from "@/lib/api-security";

export async function GET(request: NextRequest) {
    const limited = checkClawworkRateLimit(request, "agents", "read");
    if (limited) {
        logApiAuditEvent({ action: "clawwork.agents.read", status: "rate_limited", request });
        return limited;
    }

    const userId = await getAuthenticatedUserId();
    if (!userId) {
        logApiAuditEvent({ action: "clawwork.agents.read", status: "denied", request });
        return unauthorizedResponse();
    }

    const response = await proxyClawworkRequest(request, "/api/agents", userId);
    logApiAuditEvent({
        action: "clawwork.agents.read",
        status: response.ok ? "allowed" : "upstream_error",
        request,
        userId,
        details: { upstream_status: response.status },
    });
    return response;
}
