"use client";
import { useState, useMemo, useEffect } from "react";
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
    const [form, setForm] = useState({
        message: "",
        channelId: "",
        scheduleAt: "",
        frequency: "once",
        time: "09:00",
        dayOfWeek: "1",
        targetSlackUserId: "", // empty string === All (existing behavior)
    });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const selectedChannel = useMemo(() => channels.find(c => c.id === form.channelId), [channels, form.channelId]);
    const [channelMembers, setChannelMembers] = useState([]);
    const [isMembersLoading, setIsMembersLoading] = useState(false);
    const [membersError, setMembersError] = useState(null);

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

    useEffect(() => {
        // Reset target user when channel changes
        setForm((prev) => ({ ...prev, targetSlackUserId: "" }));
        setChannelMembers([]);
        setMembersError(null);

        if (!form.channelId) return;

        let cancelled = false;
        const fetchMembers = async () => {
            setIsMembersLoading(true);
            try {
                const res = await fetch(`/api/slack/channel-members?channelId=${encodeURIComponent(form.channelId)}`);
                if (!res.ok) {
                    throw new Error("Failed to load channel members");
                }
                const data = await res.json();
                if (!cancelled) {
                    setChannelMembers(data.members || []);
                }
            } catch (e) {
                if (!cancelled) {
                    setMembersError(e.message || "Failed to load channel members");
                    setChannelMembers([]);
                }
            } finally {
                if (!cancelled) {
                    setIsMembersLoading(false);
                }
            }
        };

        fetchMembers();

        return () => {
            cancelled = true;
        };
    }, [form.channelId]);

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
        let payload = {
            ...form,
            message: markdownMessage,
            channelName: selectedChannel?.name,
            // Ensure backend sees null when "All" is selected so existing behavior is preserved.
            targetSlackUserId: form.targetSlackUserId || null,
        };

        if (form.frequency === 'once') {
            // For one-time reminders, the datetime-local input is interpreted as PKT on the server.
            payload.scheduleAt = form.scheduleAt;
        } else {
            // For recurring reminders, the server calculates scheduleAt based on PKT.
            delete payload.scheduleAt;
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

            <div className="space-y-1">
                <label className="text-sm font-medium">Notify User <span className="text-xs text-gray-500">(optional)</span></label>
                <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                    value={form.targetSlackUserId}
                    onChange={(e) => setForm({ ...form, targetSlackUserId: e.target.value })}
                    disabled={!form.channelId || isMembersLoading || !!membersError}
                >
                    <option value="">All (post to channel)</option>
                    {channelMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                            {m.display || m.name} ({m.id})
                        </option>
                    ))}
                </select>
                {isMembersLoading && (
                    <p className="text-xs text-gray-500 mt-1">Loading channel members…</p>
                )}
                {membersError && (
                    <p className="text-xs text-yellow-700 mt-1">
                        Could not load channel members. Reminder will post to the channel.
                    </p>
                )}
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
