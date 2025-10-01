"use client";

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import TurndownService from 'turndown';
import MarkdownIt from 'markdown-it';
import { Button } from "@/components/ui/button";
import { ChannelCombobox } from "@/components/ChannelCombobox";

const RichTextEditor = dynamic(
  () => import('@/components/ui/RichTextEditor').then(mod => mod.RichTextEditor),
  {
    ssr: false,
    loading: () => <div className="w-full rounded-md border border-input p-4 min-h-[120px] bg-muted/50"><p>Loading editor...</p></div>
  }
);

export function EditReminderDialog({ reminder, channels, onUpdate, onClose }) {
    const md = useMemo(() => new MarkdownIt(), []);

    const getInitialHtml = () => {
        if (!reminder.message) return "";
        let standardMarkdown = reminder.message
            .replace(/<([^|]+)\|([^>]+)>/g, '[$2]($1)')
            .replace(/~([^~]+)~/g, '~~$1~~');
        return md.render(standardMarkdown);
    };

    const [editedReminder, setEditedReminder] = useState(reminder);
    const [messageHtml, setMessageHtml] = useState(getInitialHtml);
    const [isSubmitting, setIsSubmitting] = useState(false);

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
            filter: (node) => node.nodeName === 'CODE' && node.parentNode.nodeName !== 'PRE',
            replacement: (content) => `\`${content}\``
        });

        service.addRule('slackCodeBlock', {
            filter: ['pre'],
            replacement: (content) => `\`\`\`\n${content}\n\`\`\``
        });

        return service;
    }, []);

    const formatToLocalDateTime = (isoString) => {
        if (!isoString) return "";
        const date = new Date(isoString);
        const offset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - offset);
        return localDate.toISOString().slice(0, 16);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        const markdownMessage = turndownService.turndown(messageHtml);
        
        const localDate = new Date(editedReminder.scheduleAt);
        const payload = {
            ...editedReminder,
            message: markdownMessage,
            scheduleAt: localDate.toISOString(),
        };
        onUpdate(payload);
        setIsSubmitting(false);
    };
    
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
            <div className="w-full max-w-xl rounded-lg bg-background text-foreground border shadow-lg" onClick={(e) => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
                    <div className="p-4 border-b">
                        <h2 className="font-semibold text-lg">Edit Reminder</h2>
                    </div>
                    <div className="p-4 space-y-4">
                        <div>
                            <label className="text-sm font-medium">Message</label>
                            <div className="mt-1">
                                <RichTextEditor 
                                    value={messageHtml}
                                    onChange={setMessageHtml}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Channel</label>
                            <ChannelCombobox
                                channels={channels}
                                value={editedReminder.channelId}
                                onChange={(channelId) => setEditedReminder({ ...editedReminder, channelId })}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">
                                Send at <span className="text-xs text-gray-500">(PKT / GMT+5)</span>
                            </label>
                            <input
                                type="datetime-local"
                                className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2"
                                value={formatToLocalDateTime(editedReminder.scheduleAt)}
                                onChange={(e) => setEditedReminder({ ...editedReminder, scheduleAt: e.target.value })}
                                required
                            />
                        </div>
                    </div>
                    <div className="p-4 border-t flex justify-end space-x-2">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}