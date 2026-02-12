'use client'

import { useActionState } from 'react'
import Link from "next/link";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { login } from "../actions";
import { SubmitButton } from "./submit-button";

const initialState = {
    error: '',
}

export default function LoginPage() {
    const [state, formAction] = useActionState(login, initialState)

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        console.log('Submitting login form', Object.fromEntries(formData))
        // using react's startTransition to wrap the server action if needed, 
        // but formAction from useActionState handles it. 
        // However, if the button does not trigger, let's use the form's onSubmit event 
        // to call formAction manually.
        // Actually, preventing default stops the automatic form action.
        // Let's rely on the button type="submit" and form action.
        // But the user says "nothing happens". This usually means client-side hydration issue or button not being type submit.
        // Let's verify the button is type submit in the SubmitButton component.
    }

    return (
        <div className="flex justify-center items-center h-full">
            <Card className="w-full max-w-sm">
                <form action={formAction}>
                    <CardHeader>
                        <CardTitle className="text-2xl">Login</CardTitle>
                        <CardDescription>
                            Enter your email below to login to your account.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" name="email" type="email" placeholder="m@example.com" required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="password">Password</Label>
                            <Input id="password" name="password" type="password" required />
                        </div>
                        {state?.error && (
                            <p className="text-sm text-red-500">{state.error}</p>
                        )}
                    </CardContent>
                    <CardFooter>
                        <SubmitButton>Sign in</SubmitButton>
                    </CardFooter>
                    <CardFooter className="flex justify-center text-sm text-muted-foreground">
                        Don&apos;t have an account?{" "}
                        <Link href="/register" className="ml-1 font-medium underline">
                            Register
                        </Link>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
