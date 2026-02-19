'use client'

import { useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { createPost } from '@/app/(dashboard)/community/actions'

export function CreatePostDialog() {
    const formRef = useRef<HTMLFormElement>(null)
    const [open, setOpen] = useState(false)
    const [postType, setPostType] = useState('')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async (formData: FormData) => {
        setSubmitting(true)
        setError('')
        try {
            if (!postType) {
                setError('Please choose a post type.')
                return
            }

            formData.set('post_type', postType)
            const result = await createPost(formData)
            if (result?.error) {
                setError(result.error)
                return
            }

            formRef.current?.reset()
            setPostType('')
            setOpen(false)
        } catch {
            setError('Failed to create post')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> New Post
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Share with Community</DialogTitle>
                </DialogHeader>
                <form action={handleSubmit} ref={formRef} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Title</Label>
                        <Input id="title" name="title" placeholder="Need to borrow..." required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="post_type">Type</Label>
                        <Select value={postType} onValueChange={setPostType} required>
                            <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="borrow">Borrow</SelectItem>
                                <SelectItem value="lend">Lend</SelectItem>
                                <SelectItem value="alert">Alert</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="content">Details</Label>
                        <Textarea id="content" name="content" placeholder="Describe your request..." />
                    </div>
                    <input type="hidden" name="post_type" value={postType} />
                    {error ? <p className="text-sm text-red-600">{error}</p> : null}
                    <Button
                        type="submit"
                        className="w-full"
                        disabled={submitting}
                    >
                        {submitting ? 'Posting...' : 'Post'}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    )
}
