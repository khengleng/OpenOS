import { NextResponse } from "next/server";
import { COWORKER_TASK_TEMPLATES } from "@/lib/coworker-templates";

export async function GET() {
    return NextResponse.json({ templates: COWORKER_TASK_TEMPLATES });
}

