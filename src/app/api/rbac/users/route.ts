import { NextResponse } from "next/server";
import { getAuthenticatedUserId, unauthorizedResponse } from "@/lib/route-auth";
import { getCurrentUserRole } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
    const requesterId = await getAuthenticatedUserId();
    if (!requesterId) return unauthorizedResponse();

    const requesterRole = await getCurrentUserRole(requesterId);
    if (requesterRole !== "admin") {
        return NextResponse.json({ error: "Only admin can list role assignments" }, { status: 403 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role, created_at, updated_at")
        .order("updated_at", { ascending: false });

    if (error) {
        return NextResponse.json({ error: "Failed to list role assignments" }, { status: 500 });
    }

    return NextResponse.json({ assignments: data || [] });
}

