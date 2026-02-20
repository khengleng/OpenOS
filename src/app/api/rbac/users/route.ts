import { NextResponse } from "next/server";
import { getAuthenticatedUserId, unauthorizedResponse } from "@/lib/route-auth";
import { getCurrentUserRole } from "@/lib/rbac";
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

export async function GET() {
    const requesterId = await getAuthenticatedUserId();
    if (!requesterId) return unauthorizedResponse();

    const requesterRole = await getCurrentUserRole(requesterId);
    if (requesterRole !== "admin") {
        return NextResponse.json({ error: "Only admin can list role assignments" }, { status: 403 });
    }

    const supabase = createAdminClient();
    if (!supabase) {
        return NextResponse.json(
            { error: "Missing Supabase admin client configuration" },
            { status: 503 },
        );
    }
    const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role, created_at, updated_at")
        .order("updated_at", { ascending: false });

    if (error) {
        if (isMissingUserRolesTableError(error)) {
            return NextResponse.json(
                { error: "RBAC schema missing. Run Supabase migration for public.user_roles." },
                { status: 503 },
            );
        }
        return NextResponse.json({ error: "Failed to list role assignments" }, { status: 500 });
    }

    const admin = createAdminClient();
    const assignments = (data || []) as Array<{
        user_id: string;
        role: string;
        created_at?: string;
        updated_at?: string;
    }>;
    if (!admin || assignments.length === 0) {
        return NextResponse.json({ assignments });
    }

    const withEmail = await Promise.all(
        assignments.map(async (assignment) => {
            try {
                const userRes = await admin.auth.admin.getUserById(assignment.user_id);
                const email = userRes.data.user?.email || null;
                return { ...assignment, email };
            } catch {
                return { ...assignment, email: null };
            }
        }),
    );

    return NextResponse.json({ assignments: withEmail });
}
