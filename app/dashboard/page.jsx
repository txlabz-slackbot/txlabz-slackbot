"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar } from "./components/Sidebar";
import { MobileNav } from "./components/MobileNav";
import { Header } from "./components/Header";
import { CreateReminderForm } from "./components/CreateReminderForm";
import { RemindersList } from "./components/RemindersList";
import { DeliveryHistoryDialog } from "./components/DeliveryHistoryDialog";
import { EditReminderDialog } from "./components/EditReminderDialog";
import { HomeStats } from "./components/HomeStats";
import { SessionProvider } from "next-auth/react";

const PAGE_SIZE = 6;

function Dashboard() {
    const [view, setView] = useState("home");
    const [reminders, setReminders] = useState([]);
    const [channels, setChannels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedReminder, setSelectedReminder] = useState(null);
    const [editingReminder, setEditingReminder] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [isNavOpen, setIsNavOpen] = useState(false);

    const stats = useMemo(() => {
        const now = new Date();
        const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        const total = reminders.length;
        const active = reminders.filter(r => !r.isPaused && !r.sent).length;
        const delivered = reminders.filter(r => r.sent).length;
        const paused = reminders.filter(r => r.isPaused).length;
        const failed = reminders.filter(r => r.deliveries.some(d => !d.ok)).length;
        const upcoming = reminders.filter(r => {
            const scheduleAt = new Date(r.scheduleAt);
            return scheduleAt > now && scheduleAt <= next24Hours && !r.isPaused && !r.sent;
        }).length;

        return { total, active, delivered, paused, failed, upcoming };
    }, [reminders]);

    const { paginatedItems, totalPages } = useMemo(() => {
        const totalPages = Math.ceil(reminders.length / PAGE_SIZE);
        const start = (currentPage - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        return { paginatedItems: reminders.slice(start, end), totalPages };
    }, [reminders, currentPage]);

    const refresh = async () => {
        setLoading(true);
        setError("");
        try {
            const [remindersRes, channelsRes] = await Promise.all([
                fetch("/api/reminders"),
                fetch("/api/slack/channels")
            ]);
            if (!remindersRes.ok) throw new Error("Failed to fetch reminders");
            if (!channelsRes.ok) throw new Error("Failed to load Slack channels");
            const remindersData = await remindersRes.json();
            const channelsData = await channelsRes.json();
            setReminders(remindersData.items || []);
            setChannels(channelsData.channels || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { refresh(); }, []);
    
    const createReminder = async (payload) => {
        const res = await fetch("/api/reminders", { method: "POST", body: JSON.stringify(payload), headers: {'Content-Type': 'application/json'} });
        if (res.ok) {
            await refresh();
            setView('view'); 
        } else {
            setError((await res.text()) || "Failed to create reminder");
        }
    };
    
    const updateReminder = async (payload) => {
        const res = await fetch(`/api/reminders/${payload._id}`, { method: "PUT", body: JSON.stringify(payload), headers: {'Content-Type': 'application/json'} });
        if (res.ok) {
            await refresh();
            setEditingReminder(null);
        } else {
            setError((await res.text()) || "Failed to update reminder");
        }
    };

    const togglePause = async (id, isPaused) => {
        await fetch(`/api/reminders/${id}`, { method: "PUT", body: JSON.stringify({ isPaused: !isPaused }), headers: {'Content-Type': 'application/json'} });
        await refresh();
    };

    const remove = async (id) => {
        await fetch(`/api/reminders/${id}`, { method: "DELETE" });
        await refresh();
    };

    const runNow = async (id) => {
        await fetch(`/api/reminders/${id}/run`, { method: "POST" });
        await refresh();
    };

    return (
        <div className="flex h-screen bg-background">
            <Sidebar view={view} setView={setView} />
            <MobileNav view={view} setView={setView} isNavOpen={isNavOpen} setIsNavOpen={setIsNavOpen} />
            <main className="flex-1 flex flex-col overflow-y-auto">
                <div className="p-4 md:p-8 flex-1 flex flex-col">
                    <Header view={view} onMenuClick={() => setIsNavOpen(true)} />
                    {error && (<div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 text-destructive p-3 text-sm"><strong>Error:</strong> {error}</div>)}
                    
                    <div className="flex-1">
                        {loading && <p>Loading...</p>}

                        {!loading && view === 'home' && (
                            <HomeStats stats={stats} />
                        )}

                        {!loading && view === 'view' && (
                            <>
                                <RemindersList
                                    reminders={paginatedItems}
                                    onPause={togglePause}
                                    onDelete={remove}
                                    onRunNow={runNow}
                                    onSelect={setSelectedReminder}
                                    onEdit={setEditingReminder}
                                />
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-end space-x-2 py-4">
                                        <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages || 1}</span>
                                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}><ChevronLeft className="w-4 h-4 mr-1" />Previous</Button>
                                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>Next<ChevronRight className="w-4 h-4 ml-1" /></Button>
                                    </div>
                                )}
                            </>
                        )}
                        {!loading && view === 'create' && (<CreateReminderForm channels={channels} onCreate={createReminder} setView={setView} />)}
                    </div>
                </div>
            </main>
            <DeliveryHistoryDialog reminder={selectedReminder} onClose={() => setSelectedReminder(null)} />
            
            {editingReminder && (
                <EditReminderDialog
                    reminder={editingReminder}
                    channels={channels}
                    onUpdate={updateReminder}
                    onClose={() => setEditingReminder(null)}
                />
            )}
        </div>
    );
}

export default function DashboardPage() {
    return (
        <SessionProvider>
            <Dashboard />
        </SessionProvider>
    );
}