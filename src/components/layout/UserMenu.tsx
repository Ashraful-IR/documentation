"use client";

import { LogOut, Moon, ScrollText, Settings, Sun, Trash2, Users } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { SessionUser } from "@/types";

export function UserMenu({ user }: { user: SessionUser }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Signed out");
    router.push("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 rounded-full" aria-label="User menu">
          <Avatar className="size-7">
            <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex justify-between items-center gap-0.5">
            <div className="flex flex-col justify-between items-start gap-1">
              <span className="text-sm font-medium">{user.name}</span>
              <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
            </div>
            <Badge variant="secondary" className="mt-1 w-fit text-[10px] border rounded-[5px] dark:border-cyan-700 ">
              {user.role}
            </Badge>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <Settings className="size-3.5" /> Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/trash")}>
          <Trash2 className="size-3.5" /> Trash
        </DropdownMenuItem>
        {user.role === "ADMIN" && (
          <>
            <DropdownMenuItem onClick={() => router.push("/users")}>
              <Users className="size-3.5" /> Users
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/audit")}>
              <ScrollText className="size-3.5" /> Audit log
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {resolvedTheme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
          <LogOut className="size-3.5" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
