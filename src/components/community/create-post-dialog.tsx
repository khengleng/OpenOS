'use client'

import { useRef } from 'react'
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

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> New Post
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Share with Community</DialogTitle>
                </DialogHeader>
                <form action={async (formData) => {
                    await createPost(formData)
                    formRef.current?.reset()
                }} ref={formRef} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Title</Label>
                        <Input id="title" name="title" placeholder="Need to borrow..." required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="post_type">Type</Label>
                        <Select name="post_type" required>
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
                    <Button type="submit" className="w-full">Post</Button>
                </form>
            </DialogContent>
        </Dialog>
    )
}
