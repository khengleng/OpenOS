import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen overflow-hidden bg-background">
            <aside className="hidden w-64 flex-col border-r bg-muted/40 md:flex">
                <Sidebar />
            </aside>
            <main className="flex-1 overflow-y-auto p-8">
                {children}
            </main>
        </div>
    );
}
