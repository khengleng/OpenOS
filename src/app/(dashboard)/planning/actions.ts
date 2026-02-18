'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addHabit(formData: FormData) {
    const supabase = await createClient()

    const name = String(formData.get('name') || '').trim()
    const user = (await supabase.auth.getUser()).data.user

    if (!user) {
        return { error: 'Unauthorized' }
    }
    if (!name || name.length > 120) {
        return { error: 'Invalid habit name' }
    }

    const { error } = await supabase.from('habits').insert({
        name,
        user_id: user.id,
        streak_count: 0,
    })

    if (error) {
        console.error(error)
        return { error: 'Failed to add habit' }
    }

    revalidatePath('/planning')
}

export async function toggleHabit(id: string, completed: boolean) {
    const supabase = await createClient()
    const user = (await supabase.auth.getUser()).data.user

    if (!user) {
        return { error: 'Unauthorized' }
    }
    if (!id) {
        return { error: 'Invalid habit id' }
    }

    const today = new Date().toISOString().split('T')[0]

    const updateData = completed
        ? { last_completed: today } // no easy way to increment streak atomically without stored procedure or read-write, keeping simple for now
        : { last_completed: null }

    // Simple toggle for now,streak logic requires more complex query
    // For MVP: if completed today, we set last_completed. 
    // Streak calculation would ideally happen on read or separate trigger.

    const { error } = await supabase
        .from('habits')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) {
        return { error: 'Failed to update habit' }
    }

    revalidatePath('/planning')
}

export async function incrementStreak(id: string, currentStreak: number) {
    const supabase = await createClient()
    const user = (await supabase.auth.getUser()).data.user

    if (!user) {
        return { error: 'Unauthorized' }
    }
    if (!id || !Number.isFinite(currentStreak) || currentStreak < 0) {
        return { error: 'Invalid streak update' }
    }

    const today = new Date().toISOString().split('T')[0]

    const { error } = await supabase
        .from('habits')
        .update({
            last_completed: today,
            streak_count: currentStreak + 1
        })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) return { error: 'Failed' }
    revalidatePath('/planning')
}
