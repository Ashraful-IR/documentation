"use client";

import { useEffect, useState } from "react";

import { Api } from "@/lib/api/client";
import type { SessionUser } from "@/types";

export function useCurrentUser(initial?: SessionUser | null) {
  const [user, setUser] = useState<SessionUser | null | undefined>(initial);
  useEffect(() => {
    if (user !== undefined) return;
    Api.me()
      .then((u) => setUser(u))
      .catch(() => setUser(null));
  }, [user]);
  return user;
}
