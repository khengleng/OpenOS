'use client'

import { useState } from 'react'
import { Card, CardHeader, CardContent, CardTitle, CardFooter } from '@/components/ui/card'
import { Check, Flame, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { incrementStreak } from '@/app/(dashboard)/planning/actions'

interface Habit {
    id: string
    name: string
    streak_count: number
    last_completed: string | null
}

export function HabitCard({ habit }: { habit: Habit }) {
    const today = new Date().toISOString().split('T')[0]
    const isCompletedToday = habit.last_completed === today
    const [loading, setLoading] = useState(false)

    const handleComplete = async () => {
        if (isCompletedToday || loading) return
        setLoading(true)
        try {
            await incrementStreak(habit.id, habit.streak_count)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
                <div className={`p-2 rounded-full ${isCompletedToday ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                    <Check className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-medium">{habit.name}</h3>
                    <div className="flex items-center text-sm text-muted-foreground">
                        <Flame className="w-4 h4 mr-1 text-orange-500" />
                        {habit.streak_count} day streak
                    </div>
                </div>
            </div>
            <Button
                variant={isCompletedToday ? "outline" : "default"}
                onClick={handleComplete}
                disabled={isCompletedToday || loading}
            >
                {isCompletedToday ? 'Done' : 'Check In'}
            </Button>
        </Card>
    )
}
