import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

            <Card>
                <CardHeader className="flex flex-row items-start justify-between">
                    <div className="space-y-1">
                        <CardTitle>Apple Health Sync Disabled</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Connect your device to sync real-time data.
                        </p>
                    </div>
                    <Badge variant="secondary">Disabled</Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                        Apple Health integration is not enabled on this deployment yet. Activity metrics are currently
                        shown from sample data.
                    </div>
                    <div className="flex items-center gap-3">
                        <Button disabled>Coming Soon</Button>
                        <span className="text-xs text-muted-foreground">Feature flag pending secure device handshake.</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Activity className="h-3.5 w-3.5" />
                        Once enabled, sync runs continuously in the background.
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
