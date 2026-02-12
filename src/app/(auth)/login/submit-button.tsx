'use client'

import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'

export function SubmitButton({ children }: { children: React.ReactNode }) {
    const { pending } = useFormStatus()

    return (
        <Button className="w-full" disabled={pending}>
            {pending ? 'Loading...' : children}
        </Button>
    )
}
