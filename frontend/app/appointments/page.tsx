"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Plus, Calendar, Clock, ChevronLeft, ChevronRight,
  AlertTriangle, CheckCircle2, XCircle, MinusCircle, UserRound,
} from "lucide-react";
import { api } from "@/lib/api";
import type { PaginatedResponse, AppointmentListItem, Appointment, AppointmentStatus } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { AppointmentForm, type AppointmentFormSchema } from "@/components/appointments/AppointmentForm";

// ── Status config ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  AppointmentStatus,
  { label: string; variant: "default" | "success" | "outline" | "muted"; icon: React.ElementType }
> = {
  scheduled:  { label: "Scheduled",  variant: "default",  icon: Clock },
  completed:  { label: "Completed",  variant: "success",  icon: CheckCircle2 },
  cancelled:  { label: "Cancelled",  variant: "muted",    icon: XCircle },
  no_show:    { label: "No Show",    variant: "outline",  icon: MinusCircle },
};

// Next valid transitions for the quick-update dropdown
const NEXT_STATUSES: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled:  ["completed", "cancelled", "no_show"],
  completed:  [],
  cancelled:  ["scheduled"],
  no_show:    ["scheduled"],
};

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTime(t: string) {
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ── Status dropdown per row ────────────────────────────────────────────────

function StatusChanger({
  appointmentId,
  currentStatus,
}: {
  appointmentId: number;
  currentStatus: AppointmentStatus;
}) {
  const queryClient = useQueryClient();
  const options = NEXT_STATUSES[currentStatus];

  const mutation = useMutation({
    mutationFn: (newStatus: AppointmentStatus) =>
      api.patch<Appointment>(`/api/appointments/${appointmentId}/status/`, {
        status: newStatus,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
  });

  const cfg = STATUS_CONFIG[currentStatus];
  const Icon = cfg.icon;

  if (options.length === 0) {
    // Terminal state — just display a badge
    return (
      <Badge variant={cfg.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {cfg.label}
      </Badge>
    );
  }

  return (
    <Select
      value={currentStatus}
      onValueChange={(v) => mutation.mutate(v as AppointmentStatus)}
      disabled={mutation.isPending}
    >
      <SelectTrigger className="h-7 w-36 border-0 bg-transparent p-0 text-xs shadow-none focus:ring-0 hover:bg-[#F2EDE4] rounded px-2">
        <span className="flex items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 ${currentStatus === "scheduled" ? "text-[#C1674F]" : currentStatus === "completed" ? "text-[#6B8F71]" : "text-[#9C9490]"}`} />
          <span className="font-medium">{cfg.label}</span>
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={currentStatus} disabled>
          {cfg.label} (current)
        </SelectItem>
        {options.map((s) => {
          const sc = STATUS_CONFIG[s];
          const SI = sc.icon;
          return (
            <SelectItem key={s} value={s}>
              <span className="flex items-center gap-2">
                <SI className="h-3.5 w-3.5" />
                {sc.label}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

// ── Row skeleton ───────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <tr className="border-b border-[#F2EDE4]">
      {[...Array(5)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <tr>
      <td colSpan={5}>
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F2EDE4]">
            <Calendar className="h-7 w-7 text-[#C8BFBA]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#3D3A38]">
              {filtered ? "No appointments match these filters" : "No appointments yet"}
            </p>
            <p className="mt-1 text-xs text-[#9C9490]">
              {filtered ? "Try a different date or status" : "Book the first appointment to get started"}
            </p>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function AppointmentsPage() {
  const router      = useRouter();
  const queryClient = useQueryClient();

  const [date,    setDate]    = useState(todayISO());
  const [stat,    setStat]    = useState<string>("all");
  const [page,    setPage]    = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [saveWarnings, setSaveWarnings] = useState<string[]>([]);

  const PAGE_SIZE = 25;

  // ── Query ──────────────────────────────────────────────────────────
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["appointments", date, stat, page],
    queryFn: () => {
      const p = new URLSearchParams();
      if (date) p.set("date", date);
      if (stat !== "all") p.set("status", stat);
      p.set("page", String(page));
      p.set("page_size", String(PAGE_SIZE));
      return api.get<PaginatedResponse<AppointmentListItem>>(
        `/api/appointments/?${p.toString()}`
      );
    },
  });

  // ── Create ─────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (values: AppointmentFormSchema) =>
      api.post<Appointment>("/api/appointments/", {
        ...values,
        // backend expects HH:MM:SS
        time: values.time.length === 5 ? values.time + ":00" : values.time,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      if (result.warnings?.length) {
        setSaveWarnings(result.warnings);
        // Keep dialog open so user sees the warnings
      } else {
        setAddOpen(false);
        setSaveWarnings([]);
      }
    },
  });

  const appointments = data?.results ?? [];
  const totalPages   = data ? Math.ceil(data.count / PAGE_SIZE) : 1;
  const isFiltered   = stat !== "all" || !!date;

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#3D3A38]">Appointments</h1>
          {data && (
            <p className="mt-0.5 text-sm text-[#9C9490]">
              {data.count} {data.count === 1 ? "appointment" : "appointments"} found
            </p>
          )}
        </div>
        <Button onClick={() => { setSaveWarnings([]); setAddOpen(true); }}>
          <Plus className="h-4 w-4" />
          New Appointment
        </Button>
      </div>

      {/* ── Filters ────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#9C9490]" />
          <Input
            type="date"
            value={date}
            onChange={(e) => { setDate(e.target.value); setPage(1); }}
            className="w-40"
          />
          {date && (
            <button
              onClick={() => { setDate(""); setPage(1); }}
              className="text-xs text-[#9C9490] hover:text-[#C1674F] underline"
            >
              Clear
            </button>
          )}
        </div>

        <Select value={stat} onValueChange={(v) => { setStat(v); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="no_show">No Show</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => { setDate(todayISO()); setStat("all"); setPage(1); }}
        >
          Today
        </Button>
      </div>

      {/* ── Error ──────────────────────────────────────────────────── */}
      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error instanceof Error ? error.message : "Failed to load appointments"}
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-[#E2D9D0] bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#F2EDE4] bg-[#FAF7F2]">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#9C9490]">Time</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#9C9490]">Patient</th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#9C9490] sm:table-cell">Doctor</th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#9C9490] md:table-cell">Reason</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#9C9490]">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? [...Array(6)].map((_, i) => <RowSkeleton key={i} />)
              : appointments.length === 0
              ? <EmptyState filtered={isFiltered} />
              : appointments.map((appt) => (
                  <tr
                    key={appt.id}
                    className="border-b border-[#F2EDE4] last:border-0 hover:bg-[#FAF7F2] transition-colors"
                  >
                    {/* Time + date */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-medium text-[#3D3A38]">{formatTime(appt.time)}</p>
                      {!date && (
                        <p className="text-xs text-[#9C9490]">{appt.date}</p>
                      )}
                    </td>

                    {/* Patient */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => router.push(`/patients/${appt.patient}?tab=appointments`)}
                        className="flex items-center gap-2 text-left hover:text-[#C1674F] transition-colors"
                      >
                        <UserRound className="h-4 w-4 flex-shrink-0 text-[#C8BFBA]" />
                        <span className="font-medium">{appt.patient_name}</span>
                      </button>
                    </td>

                    {/* Doctor */}
                    <td className="hidden px-4 py-3 text-[#6B6460] sm:table-cell">
                      {appt.doctor_name ?? <span className="italic text-[#C8BFBA]">Unassigned</span>}
                    </td>

                    {/* Reason */}
                    <td className="hidden px-4 py-3 md:table-cell">
                      <p className="max-w-[200px] truncate text-[#6B6460]">
                        {appt.reason || <span className="italic text-[#C8BFBA]">—</span>}
                      </p>
                    </td>

                    {/* Quick status changer */}
                    <td className="px-4 py-3">
                      <StatusChanger
                        appointmentId={appt.id}
                        currentStatus={appt.status}
                      />
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ─────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-[#9C9490]">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── New Appointment Dialog ──────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setSaveWarnings([]); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Appointment</DialogTitle>
            <DialogDescription>
              Fill in the appointment details. Overlapping appointments are allowed but flagged.
            </DialogDescription>
          </DialogHeader>
          {createMutation.isError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : "Failed to create appointment"}
            </div>
          )}
          <AppointmentForm
            defaultValues={{ date, status: "scheduled" }}
            warnings={saveWarnings}
            onSubmit={async (values) => {
              await createMutation.mutateAsync(values);
            }}
            submitLabel="Book Appointment"
          />
          {/* If warnings are showing, let user explicitly close */}
          {saveWarnings.length > 0 && (
            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => { setAddOpen(false); setSaveWarnings([]); }}>
                Close (appointment was saved)
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
