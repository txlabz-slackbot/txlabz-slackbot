"use client";
import { Bell, PlusCircle, LayoutGrid, LogOut, X, Home } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function MobileNav({ view, setView, isNavOpen, setIsNavOpen }) {
    return (
        <div className={`fixed inset-0 z-50 bg-background text-foreground transform ${isNavOpen ? "translate-x-0" : "-translate-x-full"} transition-transform duration-300 ease-in-out md:hidden`}>
            <div className="flex justify-between items-center p-4 border-b">
                <h1 className="text-2xl font-bold flex items-center gap-2"><Bell className="w-6 h-6" /><span>ReminderApp</span></h1>
                <Button variant="ghost" size="icon" onClick={() => setIsNavOpen(false)}><X className="w-6 h-6" /></Button>
            </div>
            <nav className="p-4 space-y-2">
                <Button variant={view === 'home' ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => { setView('home'); setIsNavOpen(false); }}>
                    <Home className="w-5 h-5 mr-3" />Home
                </Button>
                <Button variant={view === 'view' ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => { setView('view'); setIsNavOpen(false); }}>
                    <LayoutGrid className="w-5 h-5 mr-3" />View Reminders
                </Button>
                <Button variant={view === 'create' ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => { setView('create'); setIsNavOpen(false); }}>
                    <PlusCircle className="w-5 h-5 mr-3" />Create Reminder
                </Button>
            </nav>
            <div className="absolute bottom-0 w-full p-4 border-t">
                <Button variant="ghost" className="w-full justify-start" onClick={() => signOut({ callbackUrl: "/login" })}>
                    <LogOut className="w-5 h-5 mr-3" />Logout
                </Button>
            </div>
        </div>
    );
}