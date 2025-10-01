"use client";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Header({ view, onMenuClick }) {
    const titles = {
        view: { title: "Scheduled Reminders", description: "A list of all your active and paused reminders." },
        create: { title: "Create a New Reminder", description: "Set up a new message to be sent to a Slack channel." },
    };
    const { title, description } = titles[view] || titles.view;

    return (
        <header className="mb-8 flex items-center justify-between">
            <div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h2>
                <p className="mt-1 text-muted-foreground">{description}</p>
            </div>
            <Button onClick={onMenuClick} variant="ghost" size="icon" className="md:hidden">
                <Menu className="w-6 h-6" />
            </Button>
        </header>
    );
}