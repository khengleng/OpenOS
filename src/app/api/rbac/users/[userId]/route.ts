import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId, unauthorizedResponse } from "@/lib/route-auth";
import { getCurrentUserRole } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";

type AppRole = "maker" | "checker" | "admin";

function isAppRole(value: string): value is AppRole {
    return value === "maker" || value === "checker" || value === "admin";
}

function isMissingUserRolesTableError(error: unknown): boolean {
    const code = typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code || "")
        : "";
    const message = typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message || "")
        : "";
    return code === "42P01" || /user_roles/i.test(message);
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
    const supabase = createAdminClient();
    if (!supabase) {
        return NextResponse.json(
            { error: "Missing Supabase admin client configuration" },
            { status: 503 },
        );
    }
    const now = new Date().toISOString();
    const { data, error } = await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role: roleRaw, updated_at: now }, { onConflict: "user_id" })
        .select("user_id, role, updated_at")
        .single();

    if (error) {
        if (isMissingUserRolesTableError(error)) {
            return NextResponse.json(
                { error: "RBAC schema missing. Run Supabase migration for public.user_roles." },
                { status: 503 },
            );
        }
        return NextResponse.json({ error: "Failed to assign role" }, { status: 500 });
    }

    return NextResponse.json({ assignment: data });
}

export async function DELETE(
    _request: NextRequest,
    context: { params: Promise<{ userId: string }> },
) {
    const requesterId = await getAuthenticatedUserId();
    if (!requesterId) return unauthorizedResponse();

    const requesterRole = await getCurrentUserRole(requesterId);
    if (requesterRole !== "admin") {
        return NextResponse.json({ error: "Only admin can remove roles" }, { status: 403 });
    }

    const { userId } = await context.params;
    if (!userId || userId === requesterId) {
        return NextResponse.json({ error: "Admin cannot remove their own role" }, { status: 400 });
    }

    const supabase = createAdminClient();
    if (!supabase) {
        return NextResponse.json(
            { error: "Missing Supabase admin client configuration" },
            { status: 503 },
        );
    }
    const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

    if (error) {
        if (isMissingUserRolesTableError(error)) {
            return NextResponse.json(
                { error: "RBAC schema missing. Run Supabase migration for public.user_roles." },
                { status: 503 },
            );
        }
        return NextResponse.json({ error: "Failed to remove role assignment" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, user_id: userId });
}
