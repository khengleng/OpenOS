import { NextRequest } from "next/server";
import { proxyClawworkRequest } from "@/lib/clawwork-proxy";
import { getAuthenticatedUserId, unauthorizedResponse } from "@/lib/route-auth";
import { checkClawworkRateLimit, logApiAuditEvent } from "@/lib/api-security";

export async function GET(request: NextRequest) {
    const limited = checkClawworkRateLimit(request, "simulations.list", "read");
    if (limited) {
        logApiAuditEvent({ action: "clawwork.simulations.list", status: "rate_limited", request });
        return limited;
    }

    const userId = await getAuthenticatedUserId();
    if (!userId) {
        logApiAuditEvent({ action: "clawwork.simulations.list", status: "denied", request });
        return unauthorizedResponse();
    }

    const response = await proxyClawworkRequest(request, "/api/simulations", userId);
    logApiAuditEvent({
        action: "clawwork.simulations.list",
        status: response.ok ? "allowed" : "upstream_error",
        request,
        userId,
        details: { upstream_status: response.status },
    });
    return response;
}

export async function POST(request: NextRequest) {
    const limited = checkClawworkRateLimit(request, "simulations.create", "write");
    if (limited) {
        logApiAuditEvent({ action: "clawwork.simulations.create", status: "rate_limited", request });
        return limited;
    }

    const userId = await getAuthenticatedUserId();
    if (!userId) {
        logApiAuditEvent({ action: "clawwork.simulations.create", status: "denied", request });
        return unauthorizedResponse();
    }

    const response = await proxyClawworkRequest(request, "/api/simulations", userId);
    logApiAuditEvent({
        action: "clawwork.simulations.create",
        status: response.ok ? "allowed" : "upstream_error",
        request,
        userId,
        details: { upstream_status: response.status },
    });
    return response;
}
