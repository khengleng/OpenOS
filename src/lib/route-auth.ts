import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function getAuthenticatedUserId(): Promise<string | null> {
    try {
        const cookieStore = await cookies();
        console.log("[route-auth] cookie keys:", cookieStore.getAll().map(c => c.name).join(", "));

        const supabase = await createClient();
        const {
            data: { user },
            error
        } = await supabase.auth.getUser();

        if (error) {
            console.error("[getAuthenticatedUserId] getUser error:", error);
        }

        return user?.id ?? null;
    } catch (err) {
        console.error("[getAuthenticatedUserId] createClient/getUser exception:", err);
        return null;
    }
}

export function unauthorizedResponse() {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
