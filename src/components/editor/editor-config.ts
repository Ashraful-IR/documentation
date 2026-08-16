"use client";

import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { Image } from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import StarterKit from "@tiptap/starter-kit";
import { common, createLowlight } from "lowlight";

import { CalloutExtension } from "./extensions/CalloutExtension";

const lowlight = createLowlight(common);

/**
 * One extension set for both the editor and the read-only viewer — this is
 * what keeps edit/view rendering identical (§6, §16).
 */
export function buildEditorExtensions(placeholder?: string) {
  return [
    StarterKit.configure({
      codeBlock: false, // replaced by CodeBlockLowlight below
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      // Tiptap v3's StarterKit already ships link + underline.
      link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } },
    }),
    Image.configure({ inline: false }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    CodeBlockLowlight.configure({ lowlight }),
    CalloutExtension,
    ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
  ];
}

/**
 * Shared content column: identical width + typography in edit and view mode
 * so toggling between them causes no layout shift (§16).
 */
export const contentColumnClass =
  "mx-auto w-full max-w-[680px] px-8 py-10 text-[15px] leading-7 text-foreground/90";

export const proseClass =
  "prose-p:my-3 prose-headings:mt-6 prose-headings:mb-2 prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-foreground " +
  "prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-h4:text-base " +
  "prose-a:text-primary prose-a:underline prose-a:underline-offset-2 prose-blockquote:border-l-2 prose-blockquote:border-muted prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-muted-foreground " +
  "prose-strong:font-semibold prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-mono " +
  "prose-pre:rounded-lg prose-pre:bg-zinc-900 prose-pre:p-4 prose-pre:font-mono prose-pre:text-[13px] prose-pre:leading-6 prose-pre:text-zinc-100 prose-pre:overflow-x-auto " +
  "prose-ul:my-3 prose-ul:list-disc prose-ol:my-3 prose-ol:list-decimal prose-li:my-1 " +
  "prose-hr:my-6 prose-img:my-4 prose-img:rounded-lg prose-img:border";
