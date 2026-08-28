"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity, LayoutDashboard, Users, Calendar, FileText,
  BarChart3, Settings, LogOut, ShieldCheck,
} from "lucide-react";
import { logout, useCurrentUser } from "@/lib/auth";
import { cn, getInitials } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/patients",  label: "Patients",  icon: Users },
  { href: "/appointments", label: "Appointments", icon: Calendar },
  { href: "/documents", label: "Documents", icon: FileText },
];

const DISABLED_ITEMS = [
  { label: "Analytics", icon: BarChart3 },
  { label: "Settings",  icon: Settings },
];

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrator",
  doctor: "Doctor",
  receptionist: "Receptionist",
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  async function handleLogout() {
    await logout();
    // Drop cached queries so the next session never sees the previous user's data.
    queryClient.clear();
    router.replace("/login");
  }

  return (
    <aside className="flex w-64 flex-shrink-0 flex-col border-r border-[#E2D9D0] bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-[#F2EDE4] px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C1674F]/10">
          <Activity className="h-5 w-5 text-[#C1674F]" />
        </div>
        <div>
          <p className="text-base font-semibold leading-tight text-[#3D3A38]">MedInsight</p>
          <p className="text-[11px] leading-tight text-[#9C9490]">Clinic Management</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-[#C1674F]/10 text-[#A8523C]"
                  : "text-[#6B6460] hover:bg-[#FAF7F2] hover:text-[#3D3A38]"
              )}
            >
              <Icon className={cn("h-[18px] w-[18px]", active ? "text-[#C1674F]" : "text-[#9C9490]")} />
              {item.label}
            </Link>
          );
        })}

        <div className="pt-4">
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#C8BFBA]">
            Coming soon
          </p>
          <div className="space-y-1">
            {DISABLED_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#C8BFBA]"
                  title={`${item.label} coming soon`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {item.label}
                </div>
              );
            })}
          </div>
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-[#F2EDE4] p-3">
        <div className="flex items-center gap-3 rounded-xl bg-[#FAF7F2] p-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#C1674F]/10 text-xs font-semibold text-[#C1674F]">
            {user ? getInitials(user.full_name) : "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[#3D3A38]">
              {user?.full_name ?? "—"}
            </p>
            <p className="flex items-center gap-1 text-xs text-[#9C9490] capitalize">
              <ShieldCheck className="h-3 w-3" />
              {user ? (ROLE_LABEL[user.role] ?? user.role) : ""}
            </p>
          </div>
          <button
            onClick={handleLogout}
            title="Log out"
            className="rounded-md p-1.5 text-[#9C9490] transition-colors hover:bg-[#F2EDE4] hover:text-[#A8523C]"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
