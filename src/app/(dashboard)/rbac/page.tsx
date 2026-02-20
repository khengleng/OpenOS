import { RoleManagement } from '@/app/(dashboard)/settings/role-management'

export default function RBACPage() {
    return (
        <div className="space-y-4">
            <h2 className="text-3xl font-bold tracking-tight">RBAC</h2>
            <p className="text-muted-foreground">Manage maker-checker-admin role assignments for this workspace.</p>
            <RoleManagement />
        </div>
    )
}
