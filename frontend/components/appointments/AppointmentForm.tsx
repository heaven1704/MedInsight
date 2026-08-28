"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { PaginatedResponse, CurrentUser, AppointmentStatus } from "@/types";
import { PatientPicker } from "@/components/patients/PatientPicker";

// ── Schema ─────────────────────────────────────────────────────────────────

const appointmentSchema = z.object({
  patient:  z.number({ message: "Select a patient" }).int().positive(),
  doctor:   z.number().int().positive().nullable().default(null),
  date:     z.string().min(1, "Date is required"),
  time:     z.string().min(1, "Time is required"),
  reason:   z.string().default(""),
  status:   z.enum(["scheduled", "completed", "cancelled", "no_show"]).default("scheduled"),
});

export type AppointmentFormSchema = z.infer<typeof appointmentSchema>;

// ── Props ──────────────────────────────────────────────────────────────────

interface AppointmentFormProps {
  defaultValues?: Partial<AppointmentFormSchema>;
  /** When set, the patient field is locked (coming from patient detail page) */
  lockedPatientId?: number;
  lockedPatientName?: string;
  onSubmit: (values: AppointmentFormSchema) => Promise<void>;
  submitLabel?: string;
  warnings?: string[];
}

// ── Doctor picker ──────────────────────────────────────────────────────────

function DoctorPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["doctors-list"],
    queryFn: () =>
      api.get<PaginatedResponse<CurrentUser>>(`/api/patients/?page_size=1`)
        // We need the users list — fetch from accounts endpoint
        .then(() => api.get<{ results: CurrentUser[] }>("/api/auth/doctors/")),
    retry: false,
    staleTime: 60_000,
  });

  // Fallback: fetch all users via admin (available to all auth roles since
  // we keep things permissive in Step 6). We hit /api/auth/me/ to get current
  // user as a proof the endpoint is reachable, then list doctors separately.
  const { data: doctorsData } = useQuery({
    queryKey: ["doctors"],
    queryFn: () =>
      api.get<PaginatedResponse<{ id: number; username: string; first_name: string; last_name: string; role: string }>>(
        "/api/accounts/users/?role=doctor"
      ).catch(() =>
        // Graceful fallback if /api/accounts/users/ isn't wired yet
        ({ count: 0, next: null, previous: null, results: [] })
      ),
    staleTime: 60_000,
  });

  const doctors = (doctorsData?.results ?? []).filter((u) => u.role === "doctor");

  return (
    <Select
      value={value?.toString() ?? "none"}
      onValueChange={(v) => onChange(v === "none" ? null : parseInt(v))}
    >
      <SelectTrigger>
        <SelectValue placeholder={isLoading ? "Loading doctors…" : "Select doctor (optional)"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">— No doctor assigned —</SelectItem>
        {doctors.map((d) => (
          <SelectItem key={d.id} value={d.id.toString()}>
            {d.first_name && d.last_name
              ? `${d.first_name} ${d.last_name}`
              : d.username}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── Form component ─────────────────────────────────────────────────────────

export function AppointmentForm({
  defaultValues,
  lockedPatientId,
  lockedPatientName,
  onSubmit,
  submitLabel = "Save Appointment",
  warnings = [],
}: AppointmentFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AppointmentFormSchema, unknown, AppointmentFormSchema>({
    resolver: zodResolver(appointmentSchema) as never,
    defaultValues: {
      patient: lockedPatientId ?? defaultValues?.patient ?? undefined,
      doctor:  defaultValues?.doctor ?? null,
      date:    defaultValues?.date ?? new Date().toISOString().slice(0, 10),
      time:    defaultValues?.time?.slice(0, 5) ?? "09:00",
      reason:  defaultValues?.reason ?? "",
      status:  defaultValues?.status ?? "scheduled",
    },
  });

  const watchedDoctor = watch("doctor");
  const watchedStatus = watch("status");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>

      {/* Overlap warnings from previous save attempt */}
      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            Scheduling conflict detected — appointment was still saved
          </div>
          {warnings.map((w, i) => (
            <p key={i} className="pl-6 text-xs text-amber-700">{w}</p>
          ))}
        </div>
      )}

      {/* Patient */}
      <div className="space-y-1.5">
        <Label>Patient *</Label>
        <PatientPicker
          value={watch("patient") ?? null}
          onChange={(id) => setValue("patient", id)}
          locked={!!lockedPatientId}
          lockedName={lockedPatientName}
        />
        {errors.patient && (
          <p className="text-xs text-red-600">{errors.patient.message}</p>
        )}
      </div>

      {/* Doctor */}
      <div className="space-y-1.5">
        <Label htmlFor="doctor">Doctor</Label>
        <DoctorPicker
          value={watchedDoctor}
          onChange={(id) => setValue("doctor", id)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Date */}
        <div className="space-y-1.5">
          <Label htmlFor="date">Date *</Label>
          <Input
            id="date"
            type="date"
            {...register("date")}
            aria-invalid={!!errors.date}
          />
          {errors.date && (
            <p className="text-xs text-red-600">{errors.date.message}</p>
          )}
        </div>

        {/* Time */}
        <div className="space-y-1.5">
          <Label htmlFor="time">Time *</Label>
          <Input
            id="time"
            type="time"
            {...register("time")}
            aria-invalid={!!errors.time}
          />
          {errors.time && (
            <p className="text-xs text-red-600">{errors.time.message}</p>
          )}
        </div>
      </div>

      {/* Reason */}
      <div className="space-y-1.5">
        <Label htmlFor="reason">Reason / Chief Complaint</Label>
        <textarea
          id="reason"
          rows={3}
          placeholder="e.g. Follow-up, chest pain, routine checkup…"
          className="flex w-full rounded-md border border-[#E2D9D0] bg-white px-3 py-2 text-sm text-[#3D3A38] placeholder:text-[#9C9490] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C1674F] focus-visible:ring-offset-1 resize-none"
          {...register("reason")}
        />
      </div>

      {/* Status — only shown on edit */}
      {defaultValues?.status && (
        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <Select
            value={watchedStatus}
            onValueChange={(v) => setValue("status", v as AppointmentStatus)}
          >
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="no_show">No Show</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isSubmitting} className="min-w-[140px]">
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : submitLabel}
        </Button>
      </div>
    </form>
  );
}
