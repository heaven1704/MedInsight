"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Users, CalendarCheck2, CheckCircle2, Clock, FileText,
  ChevronRight, AlertTriangle, Sparkles, UserRound, Activity,
} from "lucide-react";
import { api } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import type {
  DashboardSummary, AppointmentListItem, AppointmentStatus,
  DoctorDirectoryItem, PendingSignup,
} from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatDate, getInitials } from "@/lib/utils";

// ── Helpers ─────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function politeTitle(userRole: string | undefined): string {
  return userRole === "doctor" ? "Dr." : "";
}

function formatTime(t: string) {
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

// ── Appointment status config ───────────────────────────────────────────────
const STATUS_CONFIG: Record<
  AppointmentStatus,
  { label: string; variant: "default" | "success" | "outline" | "muted" }
> = {
  scheduled: { label: "Scheduled", variant: "default" },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "muted" },
  no_show:   { label: "No Show",   variant: "outline" },
};

const OCR_STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "success" | "outline" | "muted" }
> = {
  uploaded:     { label: "Uploaded",           variant: "muted" },
  processing:   { label: "Processing",         variant: "default" },
  processed:    { label: "OCR done",           variant: "success" },
  needs_review: { label: "Needs review",       variant: "outline" },
};

// ── Stat card ───────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  accent: string; // classes for the icon tile
}) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-[#E2D9D0] bg-white p-5 shadow-sm">
      <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none text-[#3D3A38]">{value}</p>
        <p className="mt-1.5 text-sm text-[#9C9490]">{label}</p>
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-[#E2D9D0] bg-white p-5 shadow-sm">
      <Skeleton className="h-11 w-11 rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-7 w-10" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

// ── Card wrapper (shared visual style) ──────────────────────────────────────

function Card({ title, action, children }: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#E2D9D0] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#F2EDE4] px-5 py-4">
        <h2 className="text-base font-semibold text-[#3D3A38]">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Family callout ──────────────────────────────────────────────────────────

function FamilyCallout({ suggestions }: { suggestions: DashboardSummary["family_suggestions"] }) {
  if (!suggestions.length) return null;

  const totalMatches = suggestions.reduce((sum, s) => sum + s.match_count, 0);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
            Family grouping suggestions
            <Sparkles className="h-4 w-4 text-amber-500" />
          </p>
          <p className="mt-0.5 text-xs text-amber-700">
            {suggestions.length} patient{suggestions.length !== 1 ? "s" : ""} share a phone
            number or address with {totalMatches} other record
            {totalMatches !== 1 ? "s" : ""} — they may be family members.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.slice(0, 4).map((s) => (
          <Link
            key={s.id}
            href={`/patients/${s.id}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100"
          >
            <UserRound className="h-3 w-3" />
            {s.full_name}
            <span className="text-amber-500">({s.match_count})</span>
          </Link>
        ))}
        {suggestions.length > 4 && (
          <Link
            href="/patients"
            className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-200"
          >
            +{suggestions.length - 4} more
          </Link>
        )}
      </div>
    </div>
  );
}

function FamilyCalloutSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-3 w-80" />
      </div>
    </div>
  );
}

// ── Today's Appointments table ──────────────────────────────────────────────

function TodayAppointments() {
  const router = useRouter();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard-today-appointments"],
    queryFn: () => api.get<AppointmentListItem[]>("/api/appointments/today/"),
  });

  const rows = data ?? [];

  return (
    <Card
      title="Today's Appointments"
      action={
        <Link href="/appointments" className="flex items-center gap-0.5 text-sm font-medium text-[#C1674F] hover:text-[#A8523C]">
          View all <ChevronRight className="h-4 w-4" />
        </Link>
      }
    >
      {isLoading ? (
        <div className="space-y-2.5">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : isError ? (
        <p className="py-6 text-center text-sm text-[#9C9490]">Couldn&apos;t load today&apos;s appointments.</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F2EDE4]">
            <CalendarCheck2 className="h-6 w-6 text-[#C8BFBA]" />
          </div>
          <p className="text-sm font-medium text-[#3D3A38]">No appointments today</p>
          <p className="text-xs text-[#9C9490]">Enjoy the calm, or book a new one.</p>
        </div>
      ) : (
        <div className="divide-y divide-[#F2EDE4]">
          {rows.map((appt) => {
            const cfg = STATUS_CONFIG[appt.status];
            return (
              <button
                key={appt.id}
                onClick={() => router.push(`/patients/${appt.patient}?tab=appointments`)}
                className="flex w-full items-center gap-3 rounded-lg px-1.5 py-2.5 text-left transition-colors hover:bg-[#FAF7F2]"
              >
                <div className="w-16 flex-shrink-0">
                  <p className="text-sm font-semibold text-[#3D3A38]">{formatTime(appt.time)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#3D3A38]">{appt.patient_name}</p>
                  <p className="truncate text-xs text-[#9C9490]">
                    {appt.doctor_name ?? "Unassigned"}
                    {appt.reason ? ` · ${appt.reason}` : ""}
                  </p>
                </div>
                <Badge variant={cfg.variant}>{cfg.label}</Badge>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ── Recent Patients ─────────────────────────────────────────────────────────

function RecentPatients({ patients }: { patients: DashboardSummary["recent_patients"] }) {
  return (
    <Card
      title="Recent Patients"
      action={
        <Link href="/patients" className="flex items-center gap-0.5 text-sm font-medium text-[#C1674F] hover:text-[#A8523C]">
          View all <ChevronRight className="h-4 w-4" />
        </Link>
      }
    >
      <div className="divide-y divide-[#F2EDE4]">
        {patients.map((p) => (
          <Link
            key={p.id}
            href={`/patients/${p.id}`}
            className="flex items-center gap-3 rounded-lg px-1.5 py-2.5 transition-colors hover:bg-[#FAF7F2]"
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#C1674F]/10 text-xs font-semibold text-[#C1674F]">
              {getInitials(p.full_name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[#3D3A38]">{p.full_name}</p>
              <p className="truncate text-xs text-[#9C9490]">
                {p.phone || "—"}
                {p.last_visit ? ` · Last visit ${formatDate(p.last_visit)}` : ""}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-[#C8BFBA]" />
          </Link>
        ))}
      </div>
    </Card>
  );
}

// ── Recent Documents ────────────────────────────────────────────────────────

function RecentDocuments({ documents }: { documents: DashboardSummary["recent_documents"] }) {
  return (
    <Card
      title="Recent Documents"
      action={
        <Link href="/documents" className="flex items-center gap-0.5 text-sm font-medium text-[#C1674F] hover:text-[#A8523C]">
          View all <ChevronRight className="h-4 w-4" />
        </Link>
      }
    >
      {documents.length === 0 ? (
        <p className="py-6 text-center text-sm text-[#9C9490]">No documents yet.</p>
      ) : (
        <div className="divide-y divide-[#F2EDE4]">
          {documents.map((doc) => {
            const ocr = OCR_STATUS_CONFIG[doc.processing_status];
            return (
              <Link
                key={doc.id}
                href={`/patients/${doc.patient_id}?tab=documents`}
                className="flex items-center gap-3 rounded-lg px-1.5 py-2.5 transition-colors hover:bg-[#FAF7F2]"
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#6B8F71]/10">
                  <FileText className="h-4 w-4 text-[#6B8F71]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium capitalize text-[#3D3A38]">
                    {doc.document_type.replace("_", " ")}
                  </p>
                  <p className="truncate text-xs text-[#9C9490]">
                    {doc.patient_name} · {formatDate(doc.uploaded_at)}
                  </p>
                </div>
                <Badge variant={ocr?.variant ?? "muted"}>
                  {ocr?.label ?? doc.processing_status}
                </Badge>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function ListCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[#E2D9D0] bg-white shadow-sm">
      <div className="border-b border-[#F2EDE4] px-5 py-4">
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="space-y-2.5 p-5">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

function PendingSignups() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["pending-signups"],
    queryFn: () => api.get<PendingSignup[]>("/api/auth/pending-signups/"),
  });
  const mutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "approve" | "reject" }) =>
      api.post(`/api/auth/pending-signups/${id}/${action}/`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pending-signups"] }),
  });

  return (
    <Card title="Pending Signups">
      {isLoading ? <p className="text-sm text-[#9C9490]">Loading requests…</p> : !data?.length ? <p className="text-sm text-[#9C9490]">No pending signup requests.</p> : <div className="space-y-2">
        {data.map((signup) => (
          <div key={signup.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E2D9D0] px-3 py-3">
            <div>
              <p className="text-sm font-medium text-[#3D3A38]">{signup.full_name}</p>
              <p className="text-xs capitalize text-[#9C9490]">{signup.role} · {signup.email}</p>
            </div>
            <div className="flex gap-2">
              <button className="rounded-md bg-[#6B8F71] px-3 py-1.5 text-xs font-medium text-white" onClick={() => mutation.mutate({ id: signup.id, action: "approve" })}>Approve</button>
              <button className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700" onClick={() => mutation.mutate({ id: signup.id, action: "reject" })}>Reject</button>
            </div>
          </div>
        ))}
      </div>}
    </Card>
  );
}

function AdminDashboard() {
  const { data: doctors = [], isLoading } = useQuery({
    queryKey: ["doctor-directory"],
    queryFn: () => api.get<DoctorDirectoryItem[]>("/api/auth/doctors/"),
  });
  return (
    <div className="space-y-6">
      <header className="space-y-1"><div className="flex items-center gap-2"><Activity className="h-5 w-5 text-[#C1674F]" /><h1 className="text-2xl font-semibold text-[#3D3A38]">Admin Dashboard</h1></div><p className="pl-7 text-sm text-[#9C9490]">Manage access requests and doctor contacts.</p></header>
      <PendingSignups />
      <Card title="Current Doctors">
        {isLoading ? <p className="text-sm text-[#9C9490]">Loading doctors…</p> : doctors.length === 0 ? <p className="text-sm text-[#9C9490]">No approved doctors yet.</p> : <div className="space-y-2">{doctors.map((doctor) => <div key={doctor.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E2D9D0] px-4 py-3"><div><p className="font-medium text-[#3D3A38]">{doctor.full_name}</p><p className="text-sm text-[#9C9490]">{doctor.email} · @{doctor.username}</p></div><a href={`mailto:${doctor.email}`} className="rounded-md border border-[#E2D9D0] px-3 py-1.5 text-sm font-medium text-[#C1674F] hover:bg-[#FAF7F2]">Email doctor</a></div>)}</div>}
      </Card>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useCurrentUser();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => api.get<DashboardSummary>("/api/dashboard/summary/"),
    enabled: user?.role === "doctor",
  });

  if (user?.role === "admin") return <AdminDashboard />;

  const firstName = user?.full_name?.split(" ")[0] ?? "";
  const title = politeTitle(user?.role);
  return (
    <div className="space-y-6">
      {/* ── Greeting ─────────────────────────────────────────────────── */}
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-[#C1674F]" />
          <h1 className="text-2xl font-semibold text-[#3D3A38]">
            {greeting()}, {title}{firstName}
          </h1>
        </div>
        <p className="pl-7 text-sm text-[#9C9490]">
          {isLoading
            ? "Loading your clinic at a glance…"
            : "Here&apos;s what&apos;s happening at your clinic today."}
        </p>
      </header>

      {/* ── Family callout ───────────────────────────────────────────── */}
      {isLoading ? (
        <FamilyCalloutSkeleton />
      ) : data?.family_suggestions?.length ? (
        <FamilyCallout suggestions={data.family_suggestions} />
      ) : null}

      {/* ── Stat cards ───────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          [...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              icon={Users}
              label="Total Patients"
              value={data?.total_patients ?? 0}
              accent="bg-[#C1674F]/10 text-[#A8523C]"
            />
            <StatCard
              icon={CalendarCheck2}
              label="Today's Appointments"
              value={data?.todays_appointments_count ?? 0}
              accent="bg-[#6B8F71]/10 text-[#527A59]"
            />
            <StatCard
              icon={CheckCircle2}
              label="Completed"
              value={data?.completed_appointments_count ?? 0}
              accent="bg-[#527A59]/10 text-[#3F6347]"
            />
            <StatCard
              icon={Clock}
              label="Pending"
              value={data?.pending_appointments_count ?? 0}
              accent="bg-[#E2D9D0]/60 text-[#6B6460]"
            />
          </>
        )}
      </div>

      {/* ── Error banner (whole-page failure) ─────────────────────────── */}
      {isError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Failed to load your dashboard. Please try refreshing the page.
        </div>
      )}

      {/* ── Today's appointments ─────────────────────────────────────── */}
      <TodayAppointments />

      {/* ── Recent patients + documents ──────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {isLoading ? (
          <>
            <ListCardSkeleton />
            <ListCardSkeleton />
          </>
        ) : (
          <>
            <RecentPatients patients={data?.recent_patients ?? []} />
            <RecentDocuments documents={data?.recent_documents ?? []} />
          </>
        )}
      </div>
    </div>
  );
}
