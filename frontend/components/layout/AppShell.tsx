"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shared authenticated shell for every app page (Dashboard, Patients,
 * Appointments, Documents). Handles the auth guard and renders the Sidebar
 * beside a max-width main content column. Uses the same design tokens as the
 * rest of the app (warm cream background, terracotta primary, etc.).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    } else if (!loading && user?.role === "receptionist") {
      router.replace("/login?blocked=receptionist");
    } else if (!loading && user?.role === "admin" && pathname !== "/dashboard") {
      router.replace("/dashboard");
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#FAF7F2]">
        <aside className="flex w-64 flex-shrink-0 flex-col border-r border-[#E2D9D0] bg-white" />
        <main className="flex-1 px-6 py-8 lg:px-10">
          <div className="mx-auto max-w-6xl space-y-6">
            <Skeleton className="h-9 w-72" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-28 w-full" />
              ))}
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        </main>
      </div>
    );
  }

  if (!user || user.role === "receptionist") return null;

  return (
    <div className="flex min-h-screen bg-[#FAF7F2]">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
