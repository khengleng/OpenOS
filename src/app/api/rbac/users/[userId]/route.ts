import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId, unauthorizedResponse } from "@/lib/route-auth";
import { getCurrentUserRole } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";

type AppRole = "maker" | "checker" | "admin";

function isAppRole(value: string): value is AppRole {
    return value === "maker" || value === "checker" || value === "admin";
}

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ userId: string }> },
) {
    const requesterId = await getAuthenticatedUserId();
    if (!requesterId) return unauthorizedResponse();

    const requesterRole = await getCurrentUserRole(requesterId);
    if (requesterRole !== "admin") {
        return NextResponse.json({ error: "Only admin can assign roles" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const roleRaw = String(body.role || "").trim().toLowerCase();
    if (!isAppRole(roleRaw)) {
        return NextResponse.json({ error: "Invalid role. Use maker/checker/admin." }, { status: 400 });
    }

    const { userId } = await context.params;
    const supabase = await createClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role: roleRaw, updated_at: now }, { onConflict: "user_id" })
        .select("user_id, role, updated_at")
        .single();

    if (error) {
        return NextResponse.json({ error: "Failed to assign role" }, { status: 500 });
    }

    return NextResponse.json({ assignment: data });
}

