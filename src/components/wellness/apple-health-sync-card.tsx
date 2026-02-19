import { Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export function AppleHealthSyncCard() {
    return (
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
    )
}
