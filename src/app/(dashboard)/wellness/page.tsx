import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, Footprints, Heart, Flame } from 'lucide-react'

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

            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 text-center">
                <Activity className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Apple Health Sync Disabled</h3>
                <p className="text-sm text-muted-foreground mb-4">Connect your device to sync real-time data.</p>
                <button disabled className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
                    Coming Soon
                </button>
            </div>
        </div>
    );
}
