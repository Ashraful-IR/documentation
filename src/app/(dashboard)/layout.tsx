import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { getSessionUser } from "@/lib/auth/actor";
import { getTree } from "@/services/navigation.service";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Pre-fetch the navigation tree server-side so the client sidebar doesn't
  // need to make a redundant API call on mount.
  const tree = await getTree({ id: user.id, role: user.role });

  return (
    <AppShell
      user={{
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
      }}
      initialTree={tree}
    >
      {children}
    </AppShell>
  );
}
