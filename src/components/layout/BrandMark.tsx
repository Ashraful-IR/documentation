import Image from "next/image";

import { cn } from "@/lib/utils";

const HEIGHTS = {
  sm: "h-6",
  md: "h-7",
  lg: "h-9",
} as const;

/**
 * The brand mark — `public/logo.png` rendered directly on the page
 * background (no chip/tile), sized by height while keeping its aspect ratio.
 */
export function BrandMark({ className, size = "md" }: { className?: string; size?: keyof typeof HEIGHTS }) {
  return (
    <Image
      src="/logo.png"
      alt=""
      width={700}
      height={395}
      className={cn("h-auto w-auto object-contain", HEIGHTS[size], className)}
      draggable={false}
    />
  );
}
