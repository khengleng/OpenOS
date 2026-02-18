'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createPost(formData: FormData) {
    const supabase = await createClient()

    const title = String(formData.get('title') || '').trim()
    const content = String(formData.get('content') || '').trim()
    const postType = String(formData.get('post_type') || '').trim()

    const user = (await supabase.auth.getUser()).data.user

    if (!user) {
        return { error: 'Unauthorized' }
    }
    if (!title || title.length > 160) {
        return { error: 'Invalid title' }
    }
    if (content.length > 5000) {
        return { error: 'Post content too long' }
    }
    if (!['borrow', 'lend', 'alert'].includes(postType)) {
        return { error: 'Invalid post type' }
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
