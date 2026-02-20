import { NextResponse } from "next/server";
import { getAuthenticatedUserId, unauthorizedResponse } from "@/lib/route-auth";
import { createAdminClient } from "@/lib/supabase/admin";

function isMissingUserRolesTableError(error: unknown): boolean {
    const code = typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code || "")
        : "";
    const message = typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message || "")
        : "";
    return code === "42P01" || /user_roles/i.test(message);
}

export async function POST() {
    const requesterId = await getAuthenticatedUserId();
    if (!requesterId) return unauthorizedResponse();

    const supabase = createAdminClient();
    if (!supabase) {
        return NextResponse.json(
            { error: "Missing Supabase admin client configuration" },
            { status: 503 },
        );
    }
    const countResult = await supabase
        .from("user_roles")
        .select("user_id", { head: true, count: "exact" });

    if (countResult.error) {
        if (isMissingUserRolesTableError(countResult.error)) {
            return NextResponse.json(
                { error: "RBAC schema missing. Run Supabase migration for public.user_roles." },
                { status: 503 },
            );
        }
        return NextResponse.json({ error: "Failed to inspect RBAC assignments" }, { status: 500 });
    }

    if ((countResult.count || 0) > 0) {
        return NextResponse.json(
            { error: "RBAC already initialized. Ask an existing admin to assign your role." },
            { status: 409 },
        );
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
        .from("user_roles")
        .upsert({ user_id: requesterId, role: "admin", updated_at: now }, { onConflict: "user_id" })
        .select("user_id, role, updated_at")
        .single();

    if (error) {
        if (isMissingUserRolesTableError(error)) {
            return NextResponse.json(
                { error: "RBAC schema missing. Run Supabase migration for public.user_roles." },
                { status: 503 },
            );
        }
        return NextResponse.json({ error: "Failed to bootstrap RBAC admin role" }, { status: 500 });
    }

    return NextResponse.json({
        message: "RBAC initialized. You are now admin.",
        assignment: data,
    });
}
