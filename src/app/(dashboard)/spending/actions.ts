'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addExpense(formData: FormData) {
    const supabase = await createClient()

    const amount = parseFloat(String(formData.get('amount') || ''))
    const category = String(formData.get('category') || '').trim()
    const description = String(formData.get('description') || '').trim()

    const user = (await supabase.auth.getUser()).data.user

    if (!user) {
        return { error: 'Unauthorized' }
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
        return { error: 'Invalid amount' }
    }
    if (!category || category.length > 80) {
        return { error: 'Invalid category' }
    }
    if (description.length > 1000) {
        return { error: 'Description too long' }
    }

    const { error } = await supabase.from('expenses').insert({
        user_id: user.id,
        amount,
        category,
        description,
    })

    if (error) {
        return { error: 'Failed to add expense' }
    }

    revalidatePath('/spending')
}
