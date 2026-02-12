'use client'

import { useRef } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { addExpense } from '@/app/(dashboard)/spending/actions'

const CATEGORIES = ['Food', 'Transport', 'Utilities', 'Entertainment', 'Shopping', 'Other']

export function AddExpenseDialog() {
    const formRef = useRef<HTMLFormElement>(null)

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> Log Expense
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Log New Expense</DialogTitle>
                </DialogHeader>
                <form action={async (formData) => {
                    await addExpense(formData)
                    formRef.current?.reset()
                }} ref={formRef} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="amount">Amount ($)</Label>
                        <Input id="amount" name="amount" type="number" step="0.01" placeholder="0.00" required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="category">Category</Label>
                        <Select name="category" required>
                            <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                                {CATEGORIES.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Description (Optional)</Label>
                        <Input id="description" name="description" placeholder="e.g. Lunch with team" />
                    </div>
                    <Button type="submit" className="w-full">Save Expense</Button>
                </form>
            </DialogContent>
        </Dialog>
    )
}
