import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center space-y-4">
      <h1 className="text-4xl font-bold tracking-tight">Project Nexus</h1>
      <p className="text-muted-foreground text-xl">The Personal OS (PWA)</p>
      <div className="flex gap-4">
        <Button asChild>
          <Link href="/login">Log In</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/planning">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
