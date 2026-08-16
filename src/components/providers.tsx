"use client";

import { ThemeProvider } from "next-themes";

import { Toaster } from "@/components/ui/sonner";

// next-themes injects its anti-FOUC inline <script> from a client component.
// React 19 warns that client-rendered <script> tags don't execute — a false
// positive here: the script is emitted into the server HTML and runs before
// hydration, so theme flicker prevention still works. next-themes is
// unmaintained (0.4.6, no fix upstream), so we filter the specific message
// (documented shadcn/ui workaround). Guarded so HMR re-evaluations don't
// stack wrappers on top of each other.
const g = globalThis as { __docuThemeErrorPatched?: boolean };
if (typeof window !== "undefined" && process.env.NODE_ENV === "development" && !g.__docuThemeErrorPatched) {
  g.__docuThemeErrorPatched = true;
  const orig = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("Encountered a script tag")) return;
    orig.apply(console, args);
  };
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      {children}
      <Toaster position="bottom-right" />
    </ThemeProvider>
  );
}
