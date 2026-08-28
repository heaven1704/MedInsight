"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, LogOut, Users, Activity, Calendar } from "lucide-react";
import { logout } from "@/lib/auth";
import { useCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";

export function Navbar() {
  const router = useRouter();
  const { user } = useCurrentUser();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[#E2D9D0] bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/patients" className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-[#C1674F]" />
          <span className="text-base font-semibold text-[#3D3A38]">MedInsight</span>
        </Link>

        {/* Nav links */}
        <nav className="hidden sm:flex items-center gap-1">
          <Link
            href="/patients"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-[#6B6460] hover:bg-[#F2EDE4] hover:text-[#3D3A38] transition-colors"
          >
            <Users className="h-4 w-4" />
            Patients
          </Link>
          <Link
            href="/appointments"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-[#6B6460] hover:bg-[#F2EDE4] hover:text-[#3D3A38] transition-colors"
          >
            <Calendar className="h-4 w-4" />
            Appointments
          </Link>
          <Link
            href="/documents"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-[#6B6460] hover:bg-[#F2EDE4] hover:text-[#3D3A38] transition-colors"
          >
            <FileText className="h-4 w-4" />
            Documents
          </Link>
        </nav>

        {/* User + logout */}
        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C1674F]/10 text-xs font-semibold text-[#C1674F]">
                {getInitials(user.full_name)}
              </div>
              <div className="hidden sm:block text-right">
                <p className="text-xs font-medium text-[#3D3A38] leading-tight">{user.full_name}</p>
                <p className="text-xs text-[#9C9490] capitalize">{user.role}</p>
              </div>
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Log out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
