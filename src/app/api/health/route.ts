import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json(
        {
            status: "ok",
            service: "openos-web",
            ts: new Date().toISOString(),
        },
        { status: 200 },
    );
}
