import { NextRequest } from "next/server";
import { proxyClawworkRequest } from "@/lib/clawwork-proxy";
import { getAuthenticatedUserId, unauthorizedResponse } from "@/lib/route-auth";
import { checkClawworkRateLimit, logApiAuditEvent } from "@/lib/api-security";

type Params = { params: Promise<{ simId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
    const limited = checkClawworkRateLimit(request, "simulations.stop", "write");
    if (limited) {
        logApiAuditEvent({ action: "clawwork.simulations.stop", status: "rate_limited", request });
        return limited;
    }

    const userId = await getAuthenticatedUserId();
    if (!userId) {
        logApiAuditEvent({ action: "clawwork.simulations.stop", status: "denied", request });
        return unauthorizedResponse();
    }

    const { simId } = await params;
    const response = await proxyClawworkRequest(request, `/api/simulations/${simId}/stop`, userId);
    logApiAuditEvent({
        action: "clawwork.simulations.stop",
        status: response.ok ? "allowed" : "upstream_error",
        request,
        userId,
        details: { upstream_status: response.status, simulation_id: simId },
    });
    return response;
}
