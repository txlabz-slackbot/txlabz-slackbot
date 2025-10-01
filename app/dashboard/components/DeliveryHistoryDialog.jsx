"use client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import ReactMarkdown from 'react-markdown';
import { X } from "lucide-react";

export function DeliveryHistoryDialog({ reminder, onClose }) {
    if (!reminder) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
            <div className="relative w-full max-w-2xl m-4 rounded-xl bg-card text-card-foreground p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between pb-4 border-b">
                    <div>
                        <h3 className="text-lg font-semibold">Delivery History</h3>
                         <div className="text-sm text-muted-foreground prose prose-sm break-words">
                           <ReactMarkdown>{reminder.message}</ReactMarkdown>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto mt-4">
                    {reminder.deliveries?.length ? (
                        <Table>
                            <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Status</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {reminder.deliveries.slice().reverse().map((d, idx) => (
                                    <TableRow key={idx}><TableCell>{new Date(d.at).toLocaleString()}</TableCell><TableCell>{d.ok ? "OK" : "Failed"}</TableCell><TableCell className="text-destructive">{d.error || ""}</TableCell></TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-sm text-muted-foreground text-center py-8">No deliveries yet.</div>
                    )}
                </div>
            </div>
        </div>
    );
}