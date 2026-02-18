'use client'

import { Suspense, useActionState } from 'react'
import Link from "next/link";
import { useSearchParams } from 'next/navigation'
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

function LoginForm() {
    const [state, formAction] = useActionState(login, initialState)
    const searchParams = useSearchParams()
    const checkEmail = searchParams.get('check_email') === '1'
    const callbackError = searchParams.get('error')

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
                        {checkEmail && (
                            <p className="text-sm text-blue-600">
                                Check your email and click the confirmation link to activate your account.
                            </p>
                        )}
                        {callbackError && (
                            <p className="text-sm text-red-500">{callbackError}</p>
                        )}
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

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginForm />
        </Suspense>
    )
}
