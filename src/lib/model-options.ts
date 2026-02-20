export const WORKSPACE_MODEL_OPTIONS = [
    { value: "gpt-4o", label: "GPT-4o", provider: "OpenAI" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo", provider: "OpenAI" },
    { value: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet", provider: "Anthropic" },
    { value: "claude-3-opus-20240229", label: "Claude 3 Opus", provider: "Anthropic" },
] as const;

export const DEFAULT_WORKSPACE_MODEL = "gpt-4o";

export function isAllowedWorkspaceModel(model: string): boolean {
    return WORKSPACE_MODEL_OPTIONS.some((option) => option.value === model);
}

