import { redirect } from "next/navigation";

import { getSessionUserId } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const uid = await getSessionUserId();
  redirect(uid ? "/documentation" : "/login");
}
