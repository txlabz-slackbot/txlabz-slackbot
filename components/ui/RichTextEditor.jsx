"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import React, { useState, useCallback, useEffect } from 'react';
import { 
    Bold, 
    Italic, 
    List, 
    ListOrdered, 
    Strikethrough, 
    Code,
    CodeSquare,
    Link as LinkIcon 
} from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Toolbar = ({ editor }) => {
  if (!editor) {
    return null;
  }
  
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const handleLinkOpen = useCallback(() => {
    const previousUrl = editor.getAttributes('link').href;
    setLinkUrl(previousUrl || '');
    setIsLinkDialogOpen(true);
  }, [editor]);

  const handleLinkSet = useCallback(() => {
    if (linkUrl) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    }
    setIsLinkDialogOpen(false);
    setLinkUrl('');
  }, [editor, linkUrl]);

  const buttonClasses = (isActive) =>
    `p-2 rounded-md ${isActive ? 'bg-muted' : 'hover:bg-muted'}`;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1 border-b p-2">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} disabled={!editor.can().toggleBold()} className={buttonClasses(editor.isActive('bold'))}><Bold className="w-4 h-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} disabled={!editor.can().toggleItalic()} className={buttonClasses(editor.isActive('italic'))}><Italic className="w-4 h-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} disabled={!editor.can().toggleStrike()} className={buttonClasses(editor.isActive('strike'))}><Strikethrough className="w-4 h-4" /></button>
        <button type="button" onClick={handleLinkOpen} className={buttonClasses(editor.isActive('link'))}><LinkIcon className="w-4 h-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleCode().run()} disabled={!editor.can().toggleCode()} className={buttonClasses(editor.isActive('code'))}><Code className="w-4 h-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} disabled={!editor.can().toggleCodeBlock()} className={buttonClasses(editor.isActive('codeBlock'))}><CodeSquare className="w-4 h-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} disabled={!editor.can().toggleBulletList()} className={buttonClasses(editor.isActive('bulletList'))}><List className="w-4 h-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} disabled={!editor.can().toggleOrderedList()} className={buttonClasses(editor.isActive('orderedList'))}><ListOrdered className="w-4 h-4" /></button>
      </div>

      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Link</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="link-url">URL</Label>
            <Input id="link-url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://example.com" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLinkDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleLinkSet}>Set Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const RichTextEditor = ({ value, onChange }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: true },
        orderedList: { keepMarks: true, keepAttributes: true },
      }),
      Link.configure({
        openOnClick: true,
        autolink: true,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      })
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base dark:prose-invert focus:outline-none p-4 min-h-[120px] max-w-full',
      },
    },
    // This line fixes the SSR hydration error
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor) {
      const isSame = editor.getHTML() === value;
      if (isSame) {
        return;
      }
      editor.commands.setContent(value, false);
    }
  }, [value, editor]);


  return (
    <div className="rounded-md border border-input bg-background">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
};