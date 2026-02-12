export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-4">
            <div className="w-full max-w-sm space-y-4">
                <div className="text-center">
                    <h1 className="text-2xl font-bold tracking-tight">Nexus OS</h1>
                    <p className="text-muted-foreground">Sign in to your account</p>
                </div>
                {children}
            </div>
        </div>
    );
}
