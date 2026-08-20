"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Api, ClientError } from "@/lib/api/client";

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "EDITOR" | "VIEWER";
  avatarUrl: string | null;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Api.listUsers()
      .then(setUsers)
      .catch((err) => toast.error(err instanceof ClientError ? err.message : "Failed to load users"))
      .finally(() => setLoading(false));
  }, []);

  async function changeRole(userId: string, role: UserRow["role"]) {
    try {
      const updated = await Api.updateUserRole(userId, role);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: updated.role } : u)));
      toast.success(`Role updated to ${role}`);
    } catch (err) {
      toast.error(err instanceof ClientError ? err.message : "Failed to update role");
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage roles. Editors can write and publish; viewers can only read.
      </p>

      <div className="mt-6 space-y-2">
        {loading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <Avatar className="size-8 shrink-0">
                <AvatarFallback className="text-[10px]">
                  {u.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{u.name}</p>
                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">{u.role}</Badge>
                <Select value={u.role} onValueChange={(v) => void changeRole(u.id, v as UserRow["role"])}>
                  <SelectTrigger className="w-28 sm:w-32" aria-label={`Role for ${u.name}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="EDITOR">Editor</SelectItem>
                    <SelectItem value="VIEWER">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))
        )}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        You cannot remove your own admin role.
      </p>
    </div>
  );
}
