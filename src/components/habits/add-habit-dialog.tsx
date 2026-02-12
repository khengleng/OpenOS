'use client'

import { useRef } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { addHabit } from '@/app/(dashboard)/planning/actions'

export function AddHabitDialog() {
    const formRef = useRef<HTMLFormElement>(null)

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> Add Habit
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add New Habit</DialogTitle>
                </DialogHeader>
                <form action={async (formData) => {
                    await addHabit(formData)
                    formRef.current?.reset()
                }} ref={formRef} className="space-y-4">
                    <Input name="name" placeholder="e.g. Drink Water" required />
                    <Button type="submit" className="w-full">Create</Button>
                </form>
            </DialogContent>
        </Dialog>
    )
}
