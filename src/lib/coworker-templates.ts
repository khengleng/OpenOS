export type CoworkerTemplatePriority = "low" | "medium" | "high";
export type CoworkerTemplateCategory = "business" | "personal";
export type CoworkerTemplateEscalationPolicy = "none" | "warn" | "urgent" | "blocker";
export type CoworkerTemplatePack = "general" | "finance_ops" | "sales_ops" | "hr_ops";

export type CoworkerTaskTemplate = {
    id: string;
    name: string;
    category: CoworkerTemplateCategory;
    pack: CoworkerTemplatePack;
    title: string;
    description: string;
    priority: CoworkerTemplatePriority;
    requiresApproval: boolean;
    defaultDueHours: number | null;
    defaultEscalationPolicy: CoworkerTemplateEscalationPolicy;
};

export const COWORKER_TASK_TEMPLATES: CoworkerTaskTemplate[] = [
    {
        id: "biz-meeting-summary",
        name: "Meeting Summary + Actions",
        category: "business",
        pack: "general",
        title: "Summarize meeting notes and extract action items",
        description:
            "Convert raw meeting notes into a concise summary. Include decisions, owners, due dates, and blockers in a structured list.",
        priority: "medium",
        requiresApproval: false,
        defaultDueHours: 24,
        defaultEscalationPolicy: "warn",
    },
    {
        id: "biz-weekly-kpi",
        name: "Weekly KPI Report",
        category: "business",
        pack: "general",
        title: "Draft weekly KPI report with insights",
        description:
            "Compile this week's key metrics, compare against targets, highlight anomalies, and recommend next actions.",
        priority: "medium",
        requiresApproval: false,
        defaultDueHours: 48,
        defaultEscalationPolicy: "warn",
    },
    {
        id: "biz-followup-emails",
        name: "Client Follow-up Drafts",
        category: "business",
        pack: "sales_ops",
        title: "Prepare follow-up email drafts for open client threads",
        description:
            "Create clear, professional follow-up email drafts for pending client conversations. Include context and proposed next steps.",
        priority: "high",
        requiresApproval: true,
        defaultDueHours: 12,
        defaultEscalationPolicy: "urgent",
    },
    {
        id: "biz-invoice-review",
        name: "Invoice Reconciliation",
        category: "business",
        pack: "finance_ops",
        title: "Review and reconcile pending invoices",
        description:
            "Cross-check invoice records against payment logs, flag mismatches, and produce a short reconciliation summary.",
        priority: "high",
        requiresApproval: true,
        defaultDueHours: 24,
        defaultEscalationPolicy: "urgent",
    },
    {
        id: "biz-sop-audit",
        name: "SOP Compliance Audit",
        category: "business",
        pack: "general",
        title: "Run SOP compliance check for current operations",
        description:
            "Evaluate current workflow steps against SOP requirements. Identify gaps, risk level, and immediate corrective actions.",
        priority: "medium",
        requiresApproval: true,
        defaultDueHours: 72,
        defaultEscalationPolicy: "warn",
    },
    {
        id: "biz-fin-month-end-close",
        name: "Month-End Close Checklist",
        category: "business",
        pack: "finance_ops",
        title: "Execute month-end close checklist",
        description:
            "Verify ledger completeness, identify unreconciled transactions, summarize blockers, and prepare a close readiness note.",
        priority: "high",
        requiresApproval: true,
        defaultDueHours: 24,
        defaultEscalationPolicy: "blocker",
    },
    {
        id: "biz-sales-pipeline-cleanup",
        name: "Pipeline Cleanup + Next Steps",
        category: "business",
        pack: "sales_ops",
        title: "Clean CRM pipeline and create next-step actions",
        description:
            "Detect stale opportunities, assign next actions, and draft outreach plans for deals at risk this week.",
        priority: "high",
        requiresApproval: false,
        defaultDueHours: 24,
        defaultEscalationPolicy: "urgent",
    },
    {
        id: "biz-hr-onboarding-plan",
        name: "Employee Onboarding Plan",
        category: "business",
        pack: "hr_ops",
        title: "Generate onboarding plan for a new hire",
        description:
            "Create a day 1/week 1/week 4 onboarding plan with checklist items, owners, and required approvals.",
        priority: "medium",
        requiresApproval: true,
        defaultDueHours: 72,
        defaultEscalationPolicy: "warn",
    },
    {
        id: "biz-hr-policy-change-brief",
        name: "HR Policy Change Brief",
        category: "business",
        pack: "hr_ops",
        title: "Draft policy change brief and rollout checklist",
        description:
            "Summarize policy changes, impacted teams, rollout timing, training requirements, and approval dependencies.",
        priority: "medium",
        requiresApproval: true,
        defaultDueHours: 48,
        defaultEscalationPolicy: "warn",
    },
    {
        id: "personal-daily-plan",
        name: "Daily Priority Plan",
        category: "personal",
        pack: "general",
        title: "Build a focused daily plan",
        description:
            "Create a prioritized daily plan with top 3 outcomes, schedule blocks, and quick wins based on pending tasks.",
        priority: "medium",
        requiresApproval: false,
        defaultDueHours: null,
        defaultEscalationPolicy: "none",
    },
    {
        id: "personal-weekly-review",
        name: "Weekly Personal Review",
        category: "personal",
        pack: "general",
        title: "Generate weekly personal progress review",
        description:
            "Summarize completed tasks, unfinished items, lessons learned, and next week's focus areas.",
        priority: "low",
        requiresApproval: false,
        defaultDueHours: null,
        defaultEscalationPolicy: "none",
    },
    {
        id: "personal-budget-check",
        name: "Budget Health Check",
        category: "personal",
        pack: "general",
        title: "Run weekly personal budget health check",
        description:
            "Analyze spending against plan, identify over-budget categories, and suggest practical cost adjustments.",
        priority: "high",
        requiresApproval: true,
        defaultDueHours: 72,
        defaultEscalationPolicy: "warn",
    },
    {
        id: "personal-goal-checkin",
        name: "Goal Progress Check-in",
        category: "personal",
        pack: "general",
        title: "Assess progress on active personal goals",
        description:
            "Evaluate progress against active goals, identify blockers, and generate a short execution plan for the next 7 days.",
        priority: "medium",
        requiresApproval: false,
        defaultDueHours: null,
        defaultEscalationPolicy: "none",
    },
    {
        id: "personal-wellness-routine",
        name: "Wellness Routine Planner",
        category: "personal",
        pack: "general",
        title: "Plan a realistic weekly wellness routine",
        description:
            "Create a balanced routine covering exercise, sleep, and recovery with time blocks that fit current schedule constraints.",
        priority: "low",
        requiresApproval: false,
        defaultDueHours: null,
        defaultEscalationPolicy: "none",
    },
];
