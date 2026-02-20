import { NextResponse } from "next/server";
import { getAuthenticatedUserId, unauthorizedResponse } from "@/lib/route-auth";
import { getCurrentUserRole } from "@/lib/rbac";

export async function GET() {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
        return unauthorizedResponse();
    }

    const role = await getCurrentUserRole(userId);
    if (!role) {
        return NextResponse.json(
            {
                error: "RBAC role not configured for this user",
                detail: "Assign a role in public.user_roles (maker/checker/admin).",
            },
            { status: 403 },
        );
    }

    return NextResponse.json({ role });
}

