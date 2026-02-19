import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Footprints, Heart, Flame } from 'lucide-react'
import { AppleHealthSyncCard } from '@/components/wellness/apple-health-sync-card'

export default function WellnessPage() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Vitality Sync</h2>
                <p className="text-muted-foreground">Your health data, unified.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Daily Steps</CardTitle>
                        <Footprints className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">8,432</div>
                        <p className="text-xs text-muted-foreground">Goal: 10,000</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Calories</CardTitle>
                        <Flame className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">534</div>
                        <p className="text-xs text-muted-foreground">kcal burned today</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Heart Rate</CardTitle>
                        <Heart className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">72 BPM</div>
                        <p className="text-xs text-muted-foreground">Resting avg</p>
                    </CardContent>
                </Card>
            </div>

            <AppleHealthSyncCard />
        </div>
    );
}
