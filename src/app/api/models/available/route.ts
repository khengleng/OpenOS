import { NextResponse } from "next/server";
import { getAuthenticatedUserId, unauthorizedResponse } from "@/lib/route-auth";
import { WORKSPACE_MODEL_OPTIONS } from "@/lib/model-options";

type ModelOption = {
    value: string;
    label: string;
    provider: string;
};

function dedupeOptions(options: ModelOption[]): ModelOption[] {
    const map = new Map<string, ModelOption>();
    for (const option of options) {
        if (!map.has(option.value)) {
            map.set(option.value, option);
        }
    }
    return [...map.values()];
}

async function fetchOpenAIModels(apiKey: string): Promise<ModelOption[]> {
    const res = await fetch("https://api.openai.com/v1/models", {
        headers: {
            authorization: `Bearer ${apiKey}`,
        },
        cache: "no-store",
    });
    if (!res.ok) return [];
    const payload = (await res.json()) as { data?: Array<{ id?: string }> };
    return (payload.data || [])
        .map((entry) => String(entry.id || "").trim())
        .filter((id) => id.startsWith("gpt-") || id.startsWith("o"))
        .map((id) => ({ value: id, label: id, provider: "OpenAI" }));
}

async function fetchAnthropicModels(apiKey: string): Promise<ModelOption[]> {
    const res = await fetch("https://api.anthropic.com/v1/models", {
        headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
        },
        cache: "no-store",
    });
    if (!res.ok) return [];
    const payload = (await res.json()) as { data?: Array<{ id?: string; display_name?: string }> };
    return (payload.data || [])
        .map((entry) => {
            const id = String(entry.id || "").trim();
            if (!id) return null;
            const label = String(entry.display_name || "").trim() || id;
            return { value: id, label, provider: "Anthropic" } as ModelOption;
        })
        .filter((option): option is ModelOption => Boolean(option));
}

export async function GET() {
    const userId = await getAuthenticatedUserId();
    if (!userId) return unauthorizedResponse();

    const openaiKey = (process.env.OPENAI_API_KEY || "").trim();
    const anthropicKey = (process.env.ANTHROPIC_API_KEY || "").trim();

    const dynamicOptions: ModelOption[] = [];
    if (openaiKey) {
        dynamicOptions.push(...(await fetchOpenAIModels(openaiKey)));
    }
    if (anthropicKey) {
        dynamicOptions.push(...(await fetchAnthropicModels(anthropicKey)));
    }

    const fallbackOptions: ModelOption[] = WORKSPACE_MODEL_OPTIONS.map((entry) => ({
        value: entry.value,
        label: entry.label,
        provider: entry.provider,
    }));

    const options = dedupeOptions([...dynamicOptions, ...fallbackOptions]);
    return NextResponse.json({ models: options });
}

