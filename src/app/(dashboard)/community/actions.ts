'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createPost(formData: FormData) {
    const supabase = await createClient()

    const title = formData.get('title') as string
    const content = formData.get('content') as string
    const postType = formData.get('post_type') as string

    const user = (await supabase.auth.getUser()).data.user

    if (!user) {
        return { error: 'Unauthorized' }
    }

    const { error } = await supabase.from('local_posts').insert({
        user_id: user.id,
        title,
        content,
        post_type: postType,
    })

    if (error) {
        return { error: 'Failed to create post' }
    }

    revalidatePath('/community')
}
