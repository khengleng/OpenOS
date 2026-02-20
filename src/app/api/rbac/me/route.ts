import { NextResponse } from "next/server";
import { getAuthenticatedUserId, unauthorizedResponse } from "@/lib/route-auth";
import { AppRole } from "@/lib/rbac";
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

function normalizeRole(value: unknown): AppRole | null {
    const role = String(value || "").toLowerCase();
    if (role === "maker" || role === "checker" || role === "admin") return role;
    return null;
}

export async function GET() {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
        return unauthorizedResponse();
    }

    const supabase = createAdminClient();
    if (!supabase) {
        return NextResponse.json(
            { error: "Missing Supabase admin client configuration" },
            { status: 503 },
        );
    }

    const roleResult = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

    if (roleResult.error && !isMissingUserRolesTableError(roleResult.error)) {
        return NextResponse.json({ error: "Failed to load RBAC role" }, { status: 500 });
    }

    if (isMissingUserRolesTableError(roleResult.error)) {
        return NextResponse.json({
            role: null,
            bootstrap_required: false,
            can_manage_roles: false,
            setup_required: true,
            message: "RBAC schema missing. Run Supabase migration for public.user_roles.",
        });
    }

    const role = normalizeRole(roleResult.data?.role);
    const countResult = await supabase
        .from("user_roles")
        .select("user_id", { head: true, count: "exact" });

    if (countResult.error && !isMissingUserRolesTableError(countResult.error)) {
        return NextResponse.json({ error: "Failed to inspect RBAC state" }, { status: 500 });
    }

    const hasAnyAssignments = (countResult.count || 0) > 0;
    const bootstrapRequired = !role && !hasAnyAssignments;

    return NextResponse.json({
        role,
        bootstrap_required: bootstrapRequired,
        can_manage_roles: role === "admin",
        setup_required: false,
    });
}
