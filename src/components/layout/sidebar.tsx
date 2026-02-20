"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Calendar, Wallet, Users, Activity, Settings, LogOut, Bot, ShieldCheck } from "lucide-react";

const sidebarItems = [
    { name: "Planning", href: "/planning", icon: Calendar },
    { name: "Spending", href: "/spending", icon: Wallet },
    { name: "Community", href: "/community", icon: Users },
    { name: "Wellness", href: "/wellness", icon: Activity },
    { name: "Agents", href: "/agents", icon: Bot },
    { name: "RBAC", href: "/rbac", icon: ShieldCheck },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <div className="flex h-full flex-col border-r bg-background w-64 hidden md:flex">
            <div className="p-6">
                <h1 className="text-xl font-bold tracking-tight">Nexus OS</h1>
            </div>
            <nav className="flex-1 px-4 space-y-2">
                {sidebarItems.map((item) => {
                    const isActive = pathname?.startsWith(item.href);
                    return (
                        <Button
                            key={item.href}
                            variant={isActive ? "secondary" : "ghost"}
                            className="w-full justify-start"
                            asChild
                        >
                            <Link href={item.href}>
                                <item.icon className="mr-2 h-4 w-4" />
                                {item.name}
                            </Link>
                        </Button>
                    );
                })}
            </nav>
            <div className="p-4 border-t space-y-2">
                <Link href="/settings">
                    <Button variant="ghost" className="w-full justify-start">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                    </Button>
                </Link>
                <Button variant="ghost" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                </Button>
            </div>
        </div>
    );
}
