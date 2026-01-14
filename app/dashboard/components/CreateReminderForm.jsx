"use client";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import dynamic from 'next/dynamic';
import TurndownService from 'turndown';
import { ChannelCombobox } from "@/components/ChannelCombobox";

const RichTextEditor = dynamic(
    () => import('@/components/ui/RichTextEditor').then(mod => mod.RichTextEditor),
    {
        ssr: false,
        loading: () => <div className="w-full rounded-md border border-input p-4 min-h-[120px] bg-muted/50"><p>Loading editor...</p></div>
    }
);

export function CreateReminderForm({ channels, onCreate, setView }) {
    const [form, setForm] = useState({ message: "", channelId: "", scheduleAt: "", frequency: "once", time: "09:00", dayOfWeek: "1" });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const selectedChannel = useMemo(() => channels.find(c => c.id === form.channelId), [channels, form.channelId]);

    const turndownService = useMemo(() => {
        const service = new TurndownService({
            strongDelimiter: '*',
            emDelimiter: '_',
            bulletListMarker: '*',
            codeBlockStyle: 'fenced'
        });

        service.addRule('strikethrough', {
            filter: ['del', 's', 'strike'],
            replacement: (content) => `~${content}~`
        });

        // Corrected rule for Slack-formatted links
        service.addRule('slackLink', {
            filter: 'a',
            replacement: function (content, node) {
                const href = node.getAttribute('href');
                return '<' + href + '|' + content + '>';
            }
        });

        service.addRule('slackCode', {
            filter: (node, options) => node.nodeName === 'CODE' && node.parentNode.nodeName !== 'PRE',
            replacement: (content) => `\`${content}\``
        });

        service.addRule('slackCodeBlock', {
            filter: ['pre'],
            replacement: (content) => `\`\`\`\n${content}\n\`\`\``
        });
        return service;
    }, []);

    const validateForm = () => {
        const newErrors = {};
        if (!form.message || form.message.trim() === "<p></p>" || form.message.trim() === "") {
            newErrors.message = "Message is required.";
        }
        if (!form.channelId) {
            newErrors.channelId = "Please select a channel.";
        }
        if (form.frequency === 'once' && !form.scheduleAt) {
            newErrors.scheduleAt = "Please select a date and time.";
        }
        if ((form.frequency === 'daily' || form.frequency === 'weekly') && !form.time) {
            newErrors.time = "Please select a time.";
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        setIsSubmitting(true);

        let markdownMessage = turndownService.turndown(form.message);
        let payload = { ...form, message: markdownMessage, channelName: selectedChannel?.name };

        // PKT is UTC+5
        const PKT_OFFSET = 5 * 60 * 60 * 1000; // 5 hours in milliseconds

        if (form.frequency === 'once') {
            // For one-time reminders, the datetime-local input is interpreted in the user's local timezone.
            // We can safely convert it directly to an ISO string (UTC). No manual PKT offset adjustment is needed.
            const localDate = new Date(form.scheduleAt);
            payload.scheduleAt = localDate.toISOString();
        } else {
            // For recurring reminders, calculate next occurrence in PKT
            const now = new Date();
            const [hours, minutes] = form.time.split(':').map(Number);

            let nextOccurrence = new Date();
            nextOccurrence.setHours(hours, minutes, 0, 0);

            if (form.frequency === 'daily') {
                // If the time has passed today, move to next day
                if (nextOccurrence < now) {
                    nextOccurrence.setDate(nextOccurrence.getDate() + 1);
                }

                // Skip weekends: if next occurrence is Saturday or Sunday, move to Monday
                let dayOfWeek = nextOccurrence.getDay();
                if (dayOfWeek === 6) {
                    // Saturday -> add 2 days to get to Monday
                    nextOccurrence.setDate(nextOccurrence.getDate() + 2);
                } else if (dayOfWeek === 0) {
                    // Sunday -> add 1 day to get to Monday
                    nextOccurrence.setDate(nextOccurrence.getDate() + 1);
                }

            } else if (form.frequency === 'weekly') {
                const targetDay = parseInt(form.dayOfWeek, 10);
                let dayDifference = targetDay - nextOccurrence.getDay();
                if (dayDifference < 0 || (dayDifference === 0 && nextOccurrence < now)) {
                    dayDifference += 7;
                }
                nextOccurrence.setDate(nextOccurrence.getDate() + dayDifference);
            }

            // Convert from PKT to UTC for storage
            const utcDate = new Date(nextOccurrence.getTime() - PKT_OFFSET);
            payload.scheduleAt = utcDate.toISOString();
        }
        await onCreate(payload);
        setIsSubmitting(false);
        setView('view');
    };

    return (
        <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
            <div className="space-y-1">
                <label className="text-sm font-medium">Message</label>
                <RichTextEditor value={form.message} onChange={(html) => setForm({ ...form, message: html })} />
                {errors.message && <p className="text-sm text-red-600 mt-1">{errors.message}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-sm font-medium">Channel</label>
                    <ChannelCombobox
                        channels={channels}
                        value={form.channelId}
                        onChange={(channelId) => {
                            setForm({ ...form, channelId });
                            if (errors.channelId) {
                                setErrors(prev => ({ ...prev, channelId: null }));
                            }
                        }}
                    />
                    {errors.channelId && <p className="text-sm text-red-600 mt-1">{errors.channelId}</p>}
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium">Frequency</label>
                    <select className="w-full rounded-md border border-input bg-background px-3 py-2" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                        <option value="once">Once</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                    </select>
                </div>
            </div>

            {form.frequency === "once" && (
                <div className="space-y-1">
                    <label className="text-sm font-medium">Send at <span className="text-xs text-gray-500">(PKT / GMT+5)</span></label>
                    <input type="datetime-local" className="w-full rounded-md border border-input bg-background px-3 py-2" value={form.scheduleAt} onChange={(e) => setForm({ ...form, scheduleAt: e.target.value })} />
                    {errors.scheduleAt && <p className="text-sm text-red-600 mt-1">{errors.scheduleAt}</p>}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {form.frequency === "weekly" && (
                    <div className="space-y-1">
                        <label className="text-sm font-medium">Day of the Week</label>
                        <select className="w-full rounded-md border border-input bg-background px-3 py-2" value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}>
                            <option value="1">Monday</option>
                            <option value="2">Tuesday</option>
                            <option value="3">Wednesday</option>
                            <option value="4">Thursday</option>
                            <option value="5">Friday</option>
                            <option value="6">Saturday</option>
                            <option value="0">Sunday</option>
                        </select>
                    </div>
                )}
                {(form.frequency === "daily" || form.frequency === "weekly") && (
                    <div className="space-y-1">
                        <label className="text-sm font-medium">Time <span className="text-xs text-gray-500">(PKT / GMT+5)</span></label>
                        <input type="time" className="w-full rounded-md border border-input bg-background px-3 py-2" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                        {errors.time && <p className="text-sm text-red-600 mt-1">{errors.time}</p>}
                    </div>
                )}
            </div>

            <div>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : 'Create Reminder'}
                </Button>
            </div>
        </form>
    );
}