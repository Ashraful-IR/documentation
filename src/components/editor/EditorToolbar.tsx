"use client";

import { useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Code2,
  Highlighter,
  Image as ImageIcon,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link2,
  List,
  ListOrdered,
  Strikethrough,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SaveStatus } from "./SaveStatus";
import type { SaveStatus as Status } from "@/types";

const FONT_FAMILIES: Array<{ label: string; value: string | null }> = [
  { label: "Default", value: null },
  { label: "Serif", value: `Georgia, "Times New Roman", serif` },
  { label: "Sans", value: `system-ui, -apple-system, sans-serif` },
  { label: "Mono", value: `ui-monospace, SFMono-Regular, Menlo, monospace` },
];

const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20, 24, 28, 32, 48];

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#18181b"];

interface ToolbarButtonProps {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
}

function ToolbarButton({ label, onClick, active, disabled, children }: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          aria-pressed={active}
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
            active && "bg-accent text-accent-foreground",
            disabled && "pointer-events-none opacity-40",
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

interface DropdownTriggerProps {
  label: string;
  children: ReactNode;
}

function DropdownTrigger({ label, children }: DropdownTriggerProps) {
  return (
    <button
      type="button"
      className="flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-foreground/90 transition-colors hover:bg-accent hover:text-accent-foreground"
      aria-label={label}
    >
      {children}
      <ChevronDown className="size-3 text-muted-foreground" />
    </button>
  );
}

export interface EditorToolbarProps {
  editor: Editor;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  status: Status;
}

export function EditorToolbar({ editor, zoom, onZoomChange, status }: EditorToolbarProps) {
  const s = useEditorState({
    editor,
    selector: ({ editor }) => {
      const textStyle = editor.getAttributes("textStyle") as {
        color?: string | null;
        fontSize?: string | null;
        fontFamily?: string | null;
      };
      return {
        paragraph: editor.isActive("paragraph"),
        h1: editor.isActive("heading", { level: 1 }),
        h2: editor.isActive("heading", { level: 2 }),
        h3: editor.isActive("heading", { level: 3 }),
        bold: editor.isActive("bold"),
        italic: editor.isActive("italic"),
        strike: editor.isActive("strike"),
        code: editor.isActive("code"),
        highlight: editor.isActive("highlight"),
        link: editor.isActive("link"),
        bulletList: editor.isActive("bulletList"),
        orderedList: editor.isActive("orderedList"),
        textStyle,
        align: editor.isActive({ textAlign: "center" })
          ? "center"
          : editor.isActive({ textAlign: "right" })
            ? "right"
            : editor.isActive({ textAlign: "justify" })
              ? "justify"
              : "left",
        canSink: editor.can().sinkListItem("listItem"),
        canLift: editor.can().liftListItem("listItem"),
      };
    },
  });

  const chain = () => editor.chain().focus();
  const fontSizeActive = s.textStyle?.fontSize?.replace("px", "") ?? null;
  const fontFamilyActive = FONT_FAMILIES.find((f) => f.value && s.textStyle?.fontFamily === f.value);
  const styleLabel = s.h1 ? "Heading 1" : s.h2 ? "Heading 2" : s.h3 ? "Heading 3" : "Paragraph";

  const clampZoom = (z: number) => Math.min(200, Math.max(50, z));

  return (
    <TooltipProvider delayDuration={200}>
      <div className="relative flex h-11 shrink-0 items-center border-b border-border bg-muted">
        {/* Centered control group */}
        <div className="flex w-full items-center justify-center gap-0.5 px-12">
        {/* Zoom */}
        <ToolbarButton label="Zoom out" onClick={() => onZoomChange(clampZoom(zoom - 10))}>
          <ZoomOut className="size-4" />
        </ToolbarButton>
        <span className="w-11 shrink-0 text-center text-xs tabular-nums text-muted-foreground" aria-label={`Zoom ${zoom}%`}>
          {zoom}%
        </span>
        <ToolbarButton label="Zoom in" onClick={() => onZoomChange(clampZoom(zoom + 10))}>
          <ZoomIn className="size-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1.5 h-5 bg-border" />

        {/* Block style */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <DropdownTrigger label="Block style">{styleLabel}</DropdownTrigger>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => chain().setParagraph().run()} className={cn(s.paragraph && "bg-accent")}>
              Paragraph
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => chain().toggleHeading({ level: 1 }).run()} className={cn(s.h1 && "bg-accent")}>
              Heading 1
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => chain().toggleHeading({ level: 2 }).run()} className={cn(s.h2 && "bg-accent")}>
              Heading 2
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => chain().toggleHeading({ level: 3 }).run()} className={cn(s.h3 && "bg-accent")}>
              Heading 3
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Font family */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <DropdownTrigger label="Font family">{fontFamilyActive?.label ?? "Default"}</DropdownTrigger>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {FONT_FAMILIES.map((f) => (
              <DropdownMenuItem
                key={f.label}
                onClick={() => (f.value ? chain().setFontFamily(f.value).run() : chain().unsetFontFamily().run())}
                className={cn(s.textStyle?.fontFamily === f.value && "bg-accent")}
              >
                <span style={f.value ? { fontFamily: f.value } : undefined}>{f.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Font size */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <DropdownTrigger label="Font size">{fontSizeActive ?? "Default"}</DropdownTrigger>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {FONT_SIZES.map((n) => (
              <DropdownMenuItem
                key={n}
                onClick={() => (n === 15 ? chain().unsetFontSize().run() : chain().setFontSize(`${n}px`).run())}
                className={cn(fontSizeActive === String(n) && "bg-accent")}
              >
                <span style={{ fontSize: n }}>{n}px</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="mx-1.5 h-5 bg-border" />

        {/* Inline formatting */}
        <ToolbarButton label="Bold" active={s.bold} onClick={() => chain().toggleBold().run()}>
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Italic" active={s.italic} onClick={() => chain().toggleItalic().run()}>
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Strikethrough" active={s.strike} onClick={() => chain().toggleStrike().run()}>
          <Strikethrough className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Inline code" active={s.code} onClick={() => chain().toggleCode().run()}>
          <Code2 className="size-4" />
        </ToolbarButton>

        {/* Text color */}
        <Popover>
          <PopoverTrigger asChild>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Text color"
                  className="relative flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="text-sm font-bold" style={{ color: s.textStyle?.color ?? "currentColor" }}>
                    A
                  </span>
                  <span
                    className="absolute bottom-1.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full"
                    style={{ backgroundColor: s.textStyle?.color ?? "currentColor" }}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Text color</TooltipContent>
            </Tooltip>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-fit p-2">
            <div className="grid grid-cols-8 gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  onClick={() => chain().setColor(c).run()}
                  className={cn(
                    "size-5 rounded-full border border-black/10 transition-transform hover:scale-110",
                    s.textStyle?.color === c && "ring-2 ring-ring ring-offset-1",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => chain().unsetColor().run()}
              className="mt-2 w-full rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Default color
            </button>
          </PopoverContent>
        </Popover>

        <ToolbarButton label="Highlight" active={s.highlight} onClick={() => chain().toggleHighlight().run()}>
          <Highlighter className="size-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1.5 h-5 bg-border" />

        {/* Insert */}
        <ToolbarButton
          label={s.link ? "Remove link" : "Add link"}
          active={s.link}
          onClick={() => {
            if (editor.isActive("link")) {
              chain().unsetLink().run();
            } else {
              const url = window.prompt("Link URL");
              if (url) chain().setLink({ href: url }).run();
            }
          }}
        >
          <Link2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Insert image"
          onClick={() => {
            const url = window.prompt("Image URL");
            if (url) chain().setImage({ src: url }).run();
          }}
        >
          <ImageIcon className="size-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1.5 h-5 bg-border" />

        {/* Lists + indentation */}
        <ToolbarButton label="Bullet list" active={s.bulletList} onClick={() => chain().toggleBulletList().run()}>
          <List className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Numbered list" active={s.orderedList} onClick={() => chain().toggleOrderedList().run()}>
          <ListOrdered className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Decrease indent" disabled={!s.canLift} onClick={() => chain().liftListItem("listItem").run()}>
          <IndentDecrease className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Increase indent" disabled={!s.canSink} onClick={() => chain().sinkListItem("listItem").run()}>
          <IndentIncrease className="size-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1.5 h-5 bg-border" />

        {/* Alignment */}
        <ToolbarButton label="Align left" active={s.align === "left"} onClick={() => chain().setTextAlign("left").run()}>
          <AlignLeft className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Align center" active={s.align === "center"} onClick={() => chain().setTextAlign("center").run()}>
          <AlignCenter className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Align right" active={s.align === "right"} onClick={() => chain().setTextAlign("right").run()}>
          <AlignRight className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Justify" active={s.align === "justify"} onClick={() => chain().setTextAlign("justify").run()}>
          <AlignJustify className="size-4" />
        </ToolbarButton>

        </div>
        {/* Save status pinned to the right edge, outside the centered group */}
        <div className="absolute right-3 flex h-7 items-center">
          <SaveStatus status={status} />
        </div>
      </div>
    </TooltipProvider>
  );
}
