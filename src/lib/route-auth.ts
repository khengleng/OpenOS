import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function hasSupabaseConfig() {
    return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function getAuthenticatedUserId(): Promise<string | null> {
    if (!hasSupabaseConfig()) {
        return null;
    }

    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        return user?.id ?? null;
    } catch {
        return null;
    }
}

export function unauthorizedResponse() {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
