import { AppleHealthSyncCard } from '@/components/wellness/apple-health-sync-card'

export default function WellnessPage() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Vitality Sync</h2>
                <p className="text-muted-foreground">Your health data, unified.</p>
            </div>

            <AppleHealthSyncCard />
        </div>
    );
}
