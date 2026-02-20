import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AppRole = "maker" | "checker" | "admin";

export async function getCurrentUserRole(userId: string): Promise<AppRole | null> {
    const admin = createAdminClient();
    if (admin) {
        const { data, error } = await admin
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .single();

        if (error || !data) return null;
        const role = String((data as { role?: unknown }).role || "").toLowerCase();
        if (role === "maker" || role === "checker" || role === "admin") return role;
        return null;
    }

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

    if (error || !data) return null;
    const role = String((data as { role?: unknown }).role || "").toLowerCase();
    if (role === "maker" || role === "checker" || role === "admin") return role;
    return null;
}

export function hasRole(
    role: AppRole | null,
    allowed: AppRole[],
): boolean {
    if (!role) return false;
    return allowed.includes(role);
}
