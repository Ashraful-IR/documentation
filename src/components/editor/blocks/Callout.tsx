"use client";

import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

import type { CalloutVariant } from "../extensions/CalloutExtension";

const STYLES: Record<CalloutVariant, { icon: React.ReactNode; className: string }> = {
  info: { icon: <Info className="size-4" />, className: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-100" },
  warning: { icon: <AlertTriangle className="size-4" />, className: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100" },
  success: { icon: <CheckCircle2 className="size-4" />, className: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100" },
  danger: { icon: <XCircle className="size-4" />, className: "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100" },
};

export function CalloutView(props: NodeViewProps) {
  const variant = (props.node.attrs.variant as CalloutVariant) || "info";
  const style = STYLES[variant] ?? STYLES.info;
  return (
    <NodeViewWrapper data-callout={variant}>
      <div className={`my-3 flex gap-2.5 rounded-lg border px-3.5 py-2.5 ${style.className}`}>
        <div className="mt-0.5 shrink-0">{style.icon}</div>
        <div className="min-w-0 flex-1 [&>div]:first:mt-0">
          <NodeViewContent />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
