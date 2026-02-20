export type CoworkerTemplatePriority = "low" | "medium" | "high";
export type CoworkerTemplateCategory = "business" | "personal";

export type CoworkerTaskTemplate = {
    id: string;
    name: string;
    category: CoworkerTemplateCategory;
    title: string;
    description: string;
    priority: CoworkerTemplatePriority;
    requiresApproval: boolean;
};

export const COWORKER_TASK_TEMPLATES: CoworkerTaskTemplate[] = [
    {
        id: "biz-meeting-summary",
        name: "Meeting Summary + Actions",
        category: "business",
        title: "Summarize meeting notes and extract action items",
        description:
            "Convert raw meeting notes into a concise summary. Include decisions, owners, due dates, and blockers in a structured list.",
        priority: "medium",
        requiresApproval: false,
    },
    {
        id: "biz-weekly-kpi",
        name: "Weekly KPI Report",
        category: "business",
        title: "Draft weekly KPI report with insights",
        description:
            "Compile this week's key metrics, compare against targets, highlight anomalies, and recommend next actions.",
        priority: "medium",
        requiresApproval: false,
    },
    {
        id: "biz-followup-emails",
        name: "Client Follow-up Drafts",
        category: "business",
        title: "Prepare follow-up email drafts for open client threads",
        description:
            "Create clear, professional follow-up email drafts for pending client conversations. Include context and proposed next steps.",
        priority: "high",
        requiresApproval: true,
    },
    {
        id: "biz-invoice-review",
        name: "Invoice Reconciliation",
        category: "business",
        title: "Review and reconcile pending invoices",
        description:
            "Cross-check invoice records against payment logs, flag mismatches, and produce a short reconciliation summary.",
        priority: "high",
        requiresApproval: true,
    },
    {
        id: "biz-sop-audit",
        name: "SOP Compliance Audit",
        category: "business",
        title: "Run SOP compliance check for current operations",
        description:
            "Evaluate current workflow steps against SOP requirements. Identify gaps, risk level, and immediate corrective actions.",
        priority: "medium",
        requiresApproval: true,
    },
    {
        id: "personal-daily-plan",
        name: "Daily Priority Plan",
        category: "personal",
        title: "Build a focused daily plan",
        description:
            "Create a prioritized daily plan with top 3 outcomes, schedule blocks, and quick wins based on pending tasks.",
        priority: "medium",
        requiresApproval: false,
    },
    {
        id: "personal-weekly-review",
        name: "Weekly Personal Review",
        category: "personal",
        title: "Generate weekly personal progress review",
        description:
            "Summarize completed tasks, unfinished items, lessons learned, and next week's focus areas.",
        priority: "low",
        requiresApproval: false,
    },
    {
        id: "personal-budget-check",
        name: "Budget Health Check",
        category: "personal",
        title: "Run weekly personal budget health check",
        description:
            "Analyze spending against plan, identify over-budget categories, and suggest practical cost adjustments.",
        priority: "high",
        requiresApproval: true,
    },
    {
        id: "personal-goal-checkin",
        name: "Goal Progress Check-in",
        category: "personal",
        title: "Assess progress on active personal goals",
        description:
            "Evaluate progress against active goals, identify blockers, and generate a short execution plan for the next 7 days.",
        priority: "medium",
        requiresApproval: false,
    },
    {
        id: "personal-wellness-routine",
        name: "Wellness Routine Planner",
        category: "personal",
        title: "Plan a realistic weekly wellness routine",
        description:
            "Create a balanced routine covering exercise, sleep, and recovery with time blocks that fit current schedule constraints.",
        priority: "low",
        requiresApproval: false,
    },
];
