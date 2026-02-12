'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addExpense(formData: FormData) {
    const supabase = await createClient()

    const amount = parseFloat(formData.get('amount') as string)
    const category = formData.get('category') as string
    const description = formData.get('description') as string

    const user = (await supabase.auth.getUser()).data.user

    if (!user) {
        return { error: 'Unauthorized' }
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
