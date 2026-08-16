import { redirect } from "next/navigation";

import { BrandMark } from "@/components/layout/BrandMark";
import { getSessionUser } from "@/lib/auth/actor";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Verified server-side: only redirect when the session actually resolves to
  // a real user. A stale cookie (user deleted / DB reset) falls through to the
  // form so the user can log in again instead of bouncing in a 500 loop.
  const user = await getSessionUser();
  if (user) redirect("/documentation");

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-12">
      {/* Ambient atmosphere behind the card */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-160px] h-[360px] w-[560px] -translate-x-1/2 rounded-full bg-purple-primary/15 blur-[120px]" />
        <div className="absolute bottom-[-140px] right-[10%] h-[300px] w-[300px] rounded-full bg-gp-green/10 blur-[110px]" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center justify-center gap-2.5">
          <BrandMark size="md" />
          <span className="text-4xl font-semibold tracking-tight text-text-primary">Cockpit GLM</span>
        </div>
        <div className="rounded-2xl border border-white/8 bg-surface/80 p-6 shadow-[0_16px_60px_rgba(0,0,0,0.4)] backdrop-blur-sm">
          {children}
        </div>
        <p className="mt-6 text-center font-mono text-xs text-text-disabled">
          Local-first · No cloud required
        </p>
      </div>
    </div>
  );
}
