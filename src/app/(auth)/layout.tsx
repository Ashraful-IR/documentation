import { redirect } from "next/navigation";

import { BookOpen } from "lucide-react";
import { getSessionUser } from "@/lib/auth/actor";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Verified server-side: only redirect when the session actually resolves to
  // a real user. A stale cookie (user deleted / DB reset) falls through to the
  // form so the user can log in again instead of bouncing in a 500 loop.
  const user = await getSessionUser();
  if (user) redirect("/documentation");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="mb-6 flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900">
          <BookOpen className="size-4" />
        </div>
        <span className="text-sm font-semibold tracking-tight">Documentation Platform</span>
      </div>
      <div className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
        {children}
      </div>
    </div>
  );
}
