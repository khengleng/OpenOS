import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function getAuthenticatedUserId(): Promise<string | null> {
    try {
        const supabase = await createClient();
        const {
            data: { session },
        } = await supabase.auth.getSession();
        const sessionUserId = session?.user?.id ?? null;

        const {
            data: { user },
            error
        } = await supabase.auth.getUser();

        if (error) {
            const name = String((error as { name?: unknown }).name || "");
            const message = String((error as { message?: unknown }).message || "").toLowerCase();
            const isMissingSession = name === "AuthSessionMissingError" || message.includes("auth session missing");
            if (!isMissingSession) {
                console.error("[getAuthenticatedUserId] getUser error:", error);
            }
        }

        // getUser is authoritative when available, but getSession is a stable
        // fallback to avoid false 401 during transient auth lookup issues.
        return user?.id ?? sessionUserId;
    } catch (err) {
        console.error("[getAuthenticatedUserId] createClient/getUser exception:", err);
        return null;
    }
}

export function unauthorizedResponse() {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
