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

import { signup } from "../actions";
import { SubmitButton } from "../login/submit-button";

const initialState = {
    error: '',
}

export default function RegisterPage() {
    const [state, formAction] = useActionState(signup, initialState)

    return (
        <div className="flex justify-center items-center h-full">
            <Card className="w-full max-w-sm">
                <form action={formAction}>
                    <CardHeader>
                        <CardTitle className="text-2xl">Register</CardTitle>
                        <CardDescription>
                            Create your account to start using Nexus OS.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="username">Username</Label>
                            <Input id="username" name="username" type="text" placeholder="yourname" required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" name="email" type="email" placeholder="m@example.com" required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="password">Password</Label>
                            <Input id="password" name="password" type="password" minLength={8} required />
                        </div>
                        {state?.error && (
                            <p className="text-sm text-red-500">{state.error}</p>
                        )}
                    </CardContent>
                    <CardFooter>
                        <SubmitButton>Create account</SubmitButton>
                    </CardFooter>
                    <CardFooter className="flex justify-center text-sm text-muted-foreground">
                        Already have an account?{" "}
                        <Link href="/login" className="ml-1 font-medium underline">
                            Sign in
                        </Link>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
