import { createClient } from '@/lib/supabase/server'
import { HabitCard } from '@/components/habits/habit-card'
import { AddHabitDialog } from '@/components/habits/add-habit-dialog'
import { WeatherWidget } from '@/components/planning/weather-widget'

export default async function PlanningPage() {
    const supabase = await createClient()
    const { data: habits } = await supabase.from('habits').select('*').order('created_at', { ascending: false })

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Planning</h2>
                    <p className="text-muted-foreground">The Daily Pulse — Win your day.</p>
                </div>
                <AddHabitDialog />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                {/* Weather Widget takes 1/3 space on large screens */}
                <div className="col-span-1 h-full">
                    <WeatherWidget />
                </div>

                {/* Habits take remaining space */}
                <div className="col-span-1 md:col-span-2 grid gap-4 grid-cols-1 sm:grid-cols-2">
                    {habits?.map((habit) => (
                        <HabitCard key={habit.id} habit={habit} />
                    ))}
                    {habits?.length === 0 && (
                        <div className="col-span-full text-center p-8 border rounded-lg border-dashed text-muted-foreground">
                            No habits set. Start building your flow.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
