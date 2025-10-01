"use client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Play, Pause, Trash2, Send, Edit } from "lucide-react";
import ReactMarkdown from 'react-markdown';

export function RemindersList({ reminders, onPause, onDelete, onRunNow, onSelect, onEdit }) {
    const handleActionClick = (e, action) => {
        e.stopPropagation();
        action();
    };

    const formatSchedule = (reminder) => {
        // Options to format time to PST (Asia/Karachi)
        const timeZoneOptions = { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', hour12: true };
        const dateOptions = { timeZone: 'Asia/Karachi', year: 'numeric', month: 'long', day: 'numeric' };

        if (reminder.frequency === 'daily') {
            const time = new Date(`1970-01-01T${reminder.time}Z`).toLocaleTimeString('en-US', timeZoneOptions);
            return `Daily at ${time} (PST)`;
        }
        if (reminder.frequency === 'weekly') {
            const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            const time = new Date(`1970-01-01T${reminder.time}Z`).toLocaleTimeString('en-US', timeZoneOptions);
            return `Weekly on ${days[reminder.dayOfWeek]} at ${time} (PST)`;
        }
        // Format "once" reminders to PST
        return new Date(reminder.scheduleAt).toLocaleString('en-US', { ...dateOptions, ...timeZoneOptions });
    };
    
    const stripMarkdown = (markdown) => {
        if (!markdown) return '';
        return markdown.replace(/([_*~])/g, '');
    }

    const truncateMessage = (message, wordLimit = 4) => {
        if (!message) return '';
        const words = stripMarkdown(message).split(' ');
        if (words.length > wordLimit) {
            return words.slice(0, wordLimit).join(' ') + '...';
        }
        return stripMarkdown(message);
    };

    return (
        <>
            <div className="hidden md:block rounded-md border">
                <Table>
                    <TableHeader className={"bg-accent"}><TableRow><TableHead className="w-[40%] ">Message</TableHead><TableHead>Channel</TableHead><TableHead>Schedule</TableHead><TableHead>Status</TableHead><TableHead>Last Delivery</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {reminders.map((r) => (
                            <TableRow key={r._id} onClick={() => onSelect(r)} className="cursor-pointer">
                                <TableCell className="font-medium" title={stripMarkdown(r.message)}>{truncateMessage(r.message)}</TableCell>
                                <TableCell>{r.channelName}</TableCell>
                                <TableCell>{formatSchedule(r)}</TableCell>
                                <TableCell><span className={`px-2 py-1 text-xs font-semibold rounded-full ${r.isPaused ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>{r.isPaused ? "Paused" : "Active"}</span></TableCell>
                                {/* Format the last delivery time to PST */}
                                <TableCell>{r.deliveries?.length ? new Date(r.deliveries[r.deliveries.length - 1].at).toLocaleString('en-US', { timeZone: 'Asia/Karachi' }) : '—'}</TableCell>
                                <TableCell className="text-right"><div className="flex items-center justify-end space-x-2">
                                    <Button variant="ghost" size="icon" onClick={(e) => handleActionClick(e, () => onEdit(r))} title="Edit"><Edit className="w-4 h-4" /></Button> 
                                    <Button variant="ghost" size="icon" onClick={(e) => handleActionClick(e, () => onPause(r._id, r.isPaused))} title={r.isPaused ? "Resume" : "Pause"}>{r.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}</Button>
                                    <Button variant="ghost" size="icon" onClick={(e) => handleActionClick(e, () => onRunNow(r._id))} title="Run Now"><Send className="w-4 h-4" /></Button>
                                    <Button variant="ghost" size="icon" onClick={(e) => handleActionClick(e, () => onDelete(r._id))} title="Delete"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                                </div></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
                {reminders.map((r) => (
                    <div key={r._id} onClick={() => onSelect(r)} className="bg-card text-card-foreground border rounded-lg p-4 space-y-3 cursor-pointer flex flex-col">
                        <div className="font-semibold break-words" title={stripMarkdown(r.message)}>{truncateMessage(r.message)}</div>
                        <div className="text-sm text-muted-foreground space-y-1">
                            <p><strong>Channel:</strong> {r.channelName}</p>
                            <p><strong>Schedule:</strong> {formatSchedule(r)}</p>
                            <p><strong>Status:</strong> <span className={`px-2 py-1 text-xs font-semibold rounded-full ${r.isPaused ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>{r.isPaused ? "Paused" : "Active"}</span></p>
                        </div>
                        <div className="flex items-center justify-end space-x-2 border-t pt-2">
                            <Button variant="ghost" size="sm" onClick={(e) => handleActionClick(e, () => onEdit(r))} title="Edit"><Edit className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={(e) => handleActionClick(e, () => onPause(r._id, r.isPaused))} title={r.isPaused ? "Resume" : "Pause"}>{r.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}</Button>
                            <Button variant="ghost" size="sm" onClick={(e) => handleActionClick(e, () => onRunNow(r._id))} title="Run Now"><Send className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={(e) => handleActionClick(e, () => onDelete(r._id))} title="Delete"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}