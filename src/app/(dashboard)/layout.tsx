import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { getSessionUser } from "@/lib/auth/actor";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <AppShell
      user={{
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
      }}
    >
      {children}
    </AppShell>
  );
}
