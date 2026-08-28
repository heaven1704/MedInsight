"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Calendar, FileText, Users, UserRound,
  AlertTriangle, CheckCircle2, Pencil, Trash2, Loader2, X,
  Clock, CheckCircle, XCircle, MinusCircle, Plus,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Patient, PatientListItem, AppointmentListItem, Appointment, AppointmentStatus } from "@/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { PatientForm, type PatientFormSchema } from "@/components/patients/PatientForm";
import { AppointmentForm, type AppointmentFormSchema } from "@/components/appointments/AppointmentForm";
import { formatDate, getInitials } from "@/lib/utils";
import Link from "next/link";
import DocumentsSection from "@/components/documents/DocumentsSection";

// ── Status config (mirrors appointments page) ─────────────────────────────
const STATUS_CONFIG: Record<AppointmentStatus, { label: string; icon: React.ElementType; color: string }> = {
  scheduled: { label: "Scheduled", icon: Clock,        color: "text-[#C1674F]" },
  completed: { label: "Completed", icon: CheckCircle,  color: "text-[#6B8F71]" },
  cancelled: { label: "Cancelled", icon: XCircle,      color: "text-[#9C9490]" },
  no_show:   { label: "No Show",   icon: MinusCircle,  color: "text-[#9C9490]" },
};

const NEXT_STATUSES: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled: ["completed", "cancelled", "no_show"],
  completed: [],
  cancelled: ["scheduled"],
  no_show:   ["scheduled"],
};

function formatTime(t: string) {
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

// ── Appointments tab ───────────────────────────────────────────────────────
function AppointmentsTab({ patientId, patientName }: { patientId: number; patientName: string }) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [saveWarnings, setSaveWarnings] = useState<string[]>([]);

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["patient-appointments", patientId],
    queryFn: () =>
      api.get<AppointmentListItem[]>(
        `/api/appointments/?patient=${patientId}&page_size=50`
      ).then((r) => (r as unknown as { results: AppointmentListItem[] }).results ?? r),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: AppointmentStatus }) =>
      api.patch<Appointment>(`/api/appointments/${id}/status/`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["patient-appointments", patientId] }),
  });

  const createMutation = useMutation({
    mutationFn: (values: AppointmentFormSchema) =>
      api.post<Appointment>("/api/appointments/", {
        ...values,
        time: values.time.length === 5 ? values.time + ":00" : values.time,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["patient-appointments", patientId] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      if (result.warnings?.length) {
        setSaveWarnings(result.warnings);
      } else {
        setAddOpen(false);
        setSaveWarnings([]);
      }
    },
  });

  const list = appointments ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#9C9490]">
          {isLoading ? "Loading…" : `${list.length} appointment${list.length !== 1 ? "s" : ""}`}
        </p>
        <Button size="sm" onClick={() => { setSaveWarnings([]); setAddOpen(true); }}>
          <Plus className="h-3.5 w-3.5" />
          Book Appointment
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-[#E2D9D0] bg-white py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F2EDE4]">
            <Calendar className="h-6 w-6 text-[#C8BFBA]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#3D3A38]">No appointments yet</p>
            <p className="mt-1 text-xs text-[#9C9490]">Book the first appointment for this patient.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((appt) => {
            const cfg  = STATUS_CONFIG[appt.status];
            const Icon = cfg.icon;
            const next = NEXT_STATUSES[appt.status];
            return (
              <div
                key={appt.id}
                className="flex items-center justify-between rounded-xl border border-[#E2D9D0] bg-white px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 flex-shrink-0 ${cfg.color}`} />
                  <div>
                    <p className="text-sm font-medium text-[#3D3A38]">
                      {appt.date} at {formatTime(appt.time)}
                    </p>
                    <p className="text-xs text-[#9C9490]">
                      {appt.doctor_name ?? "No doctor assigned"}
                      {appt.reason ? ` · ${appt.reason}` : ""}
                    </p>
                  </div>
                </div>

                {next.length > 0 ? (
                  <Select
                    value={appt.status}
                    onValueChange={(v) => statusMutation.mutate({ id: appt.id, status: v as AppointmentStatus })}
                    disabled={statusMutation.isPending}
                  >
                    <SelectTrigger className="h-7 w-32 text-xs border-[#E2D9D0]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={appt.status} disabled>{cfg.label}</SelectItem>
                      {next.map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant={appt.status === "completed" ? "success" : "muted"}>
                    {cfg.label}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Book appointment dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setSaveWarnings([]); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Book Appointment</DialogTitle>
            <DialogDescription>Schedule a new appointment for {patientName}.</DialogDescription>
          </DialogHeader>
          {createMutation.isError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {createMutation.error instanceof Error ? createMutation.error.message : "Failed"}
            </div>
          )}
          <AppointmentForm
            lockedPatientId={patientId}
            lockedPatientName={patientName}
            warnings={saveWarnings}
            onSubmit={async (v) => { await createMutation.mutateAsync(v); }}
            submitLabel="Book Appointment"
          />
          {saveWarnings.length > 0 && (
            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => { setAddOpen(false); setSaveWarnings([]); }}>
                Close (appointment was saved)
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

// ── Info row ───────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="w-36 flex-shrink-0 text-xs font-medium uppercase tracking-wide text-[#9C9490]">
        {label}
      </dt>
      <dd className="text-sm text-[#3D3A38]">{value ?? <span className="italic text-[#C8BFBA]">—</span>}</dd>
    </div>
  );
}

// ── Family banner ──────────────────────────────────────────────────────────
function FamilyTab({ patient }: { patient: Patient }) {
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState<number[]>([]);

  const { data: possibleFamily, isLoading: pfLoading } = useQuery({
    queryKey: ["possible-family", patient.id],
    queryFn: () => api.get<PatientListItem[]>(`/api/patients/${patient.id}/possible-family/`),
  });

  const addToFamilyMutation = useMutation({
    mutationFn: (otherId: number) =>
      api.post(`/api/patients/${patient.id}/add-to-family/`, {
        other_patient_id: otherId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient", patient.id] });
      queryClient.invalidateQueries({ queryKey: ["possible-family", patient.id] });
      queryClient.invalidateQueries({ queryKey: ["family-members"] });
    },
  });

  const { data: familyMembers } = useQuery({
    queryKey: ["family-members", patient.family],
    queryFn: () =>
      api.get<PatientListItem[]>(`/api/families/${patient.family}/members/`),
    enabled: !!patient.family,
  });

  const visibleMatches = (possibleFamily ?? []).filter(
    (m) => !dismissed.includes(m.id)
  );

  return (
    <div className="space-y-6">
      {/* ── Possible-family banner ──────────────────────────────── */}
      {!pfLoading && visibleMatches.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">
                {visibleMatches.length}{" "}
                {visibleMatches.length === 1 ? "patient shares" : "patients share"}{" "}
                the same phone number or address
              </p>
              <p className="mt-0.5 text-xs text-amber-700">
                They may be family members. Group them to link their records.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {visibleMatches.map((match) => (
              <div
                key={match.id}
                className="flex items-center justify-between rounded-lg border border-amber-200 bg-white px-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C1674F]/10 text-xs font-semibold text-[#C1674F]">
                    {getInitials(match.full_name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#3D3A38]">{match.full_name}</p>
                    <p className="text-xs text-[#9C9490]">{match.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => addToFamilyMutation.mutate(match.id)}
                    disabled={addToFamilyMutation.isPending}
                  >
                    {addToFamilyMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    Group
                  </Button>
                  <button
                    onClick={() => setDismissed((d) => [...d, match.id])}
                    className="rounded p-1 text-[#9C9490] hover:bg-amber-100 hover:text-amber-700"
                    title="Dismiss"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Current family members ──────────────────────────────── */}
      {patient.family ? (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[#3D3A38]">
            {patient.family_detail?.family_name ?? "Family"}{" "}
            <span className="font-normal text-[#9C9490]">
              ({patient.family_detail?.member_count ?? "?"} members)
            </span>
          </h3>

          <div className="space-y-2">
            {(familyMembers ?? []).map((m) => (
              <Link
                key={m.id}
                href={`/patients/${m.id}`}
                className={`flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors hover:bg-[#FAF7F2] ${
                  m.id === patient.id
                    ? "border-[#C1674F]/30 bg-[#C1674F]/5"
                    : "border-[#E2D9D0] bg-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C1674F]/10 text-xs font-semibold text-[#C1674F]">
                    {getInitials(m.full_name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#3D3A38]">
                      {m.full_name}{" "}
                      {m.id === patient.id && (
                        <span className="text-xs font-normal text-[#C1674F]">(this patient)</span>
                      )}
                    </p>
                    <p className="text-xs text-[#9C9490]">{m.phone}</p>
                  </div>
                </div>
                <Badge variant="outline">{m.gender}</Badge>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        !pfLoading && visibleMatches.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F2EDE4]">
              <Users className="h-6 w-6 text-[#C8BFBA]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#3D3A38]">No family group</p>
              <p className="mt-1 text-xs text-[#9C9490]">
                No patients share this patient's phone number or address.
              </p>
            </div>
          </div>
        )
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const queryClient = useQueryClient();

  const [editOpen,   setEditOpen]   = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: patient, isLoading, isError } = useQuery({
    queryKey: ["patient", id],
    queryFn: () => api.get<Patient>(`/api/patients/${id}/`),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (values: PatientFormSchema) =>
      api.patch<Patient>(`/api/patients/${id}/`, values),
    onSuccess: (updated) => {
      queryClient.setQueryData(["patient", id], updated);
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      setEditOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/patients/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      router.push("/patients");
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        <DetailSkeleton />
      </div>
    );
  }

  if (isError || !patient) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="font-medium text-red-700">Patient not found</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push("/patients")}>
            Back to Patients
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* ── Back + actions ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/patients")}
          className="flex items-center gap-1.5 text-sm text-[#9C9490] hover:text-[#3D3A38] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          All Patients
        </button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* ── Patient card ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[#E2D9D0] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {/* Avatar */}
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-[#C1674F]/10 text-xl font-bold text-[#C1674F]">
            {getInitials(patient.full_name)}
          </div>
          {/* Header info */}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-[#3D3A38]">{patient.full_name}</h1>
              <Badge variant="outline">{patient.gender}</Badge>
              {patient.blood_group !== "unknown" && (
                <Badge variant="default">{patient.blood_group}</Badge>
              )}
              {patient.family_detail && (
                <Badge variant="success">
                  <UserRound className="mr-1 h-3 w-3" />
                  {patient.family_detail.family_name}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-[#9C9490]">
              DOB {formatDate(patient.date_of_birth)} · {patient.phone}
              {patient.email && ` · ${patient.email}`}
            </p>
          </div>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────── */}
      <Tabs defaultValue="info">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="info">Patient Information</TabsTrigger>
          <TabsTrigger value="medical">Medical History</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="family">Family</TabsTrigger>
        </TabsList>

        {/* ── Patient Information ──────────────────────────────────── */}
        <TabsContent value="info">
          <div className="rounded-xl border border-[#E2D9D0] bg-white p-6">
            <dl className="space-y-4">
              <InfoRow label="Full Name"     value={patient.full_name} />
              <InfoRow label="Date of Birth" value={formatDate(patient.date_of_birth)} />
              <InfoRow label="Gender"        value={<Badge variant="outline">{patient.gender}</Badge>} />
              <InfoRow label="Phone"         value={patient.phone} />
              <InfoRow label="Email"         value={patient.email || null} />
              <InfoRow label="Address"       value={patient.address || null} />
              <InfoRow label="Blood Group"   value={patient.blood_group !== "unknown" ? patient.blood_group : null} />
              <InfoRow label="Added"         value={formatDate(patient.created_at)} />
              <InfoRow label="Last Updated"  value={formatDate(patient.updated_at)} />
            </dl>
          </div>
        </TabsContent>

        {/* ── Medical History ──────────────────────────────────────── */}
        <TabsContent value="medical">
          <div className="space-y-4">
            {/* Allergies */}
            <div className="rounded-xl border border-[#E2D9D0] bg-white p-6">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#3D3A38]">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Known Allergies
              </h3>
              {patient.allergies === null ? (
                <p className="text-sm italic text-[#9C9490]">
                  Clinical access restricted — contact your administrator.
                </p>
              ) : patient.allergies ? (
                <p className="text-sm text-[#3D3A38] whitespace-pre-wrap">{patient.allergies}</p>
              ) : (
                <p className="text-sm italic text-[#9C9490]">No known allergies recorded</p>
              )}
            </div>

            {/* Medical history */}
            <div className="rounded-xl border border-[#E2D9D0] bg-white p-6">
              <h3 className="mb-3 text-sm font-semibold text-[#3D3A38]">Medical History</h3>
              {patient.medical_history === null ? (
                <p className="text-sm italic text-[#9C9490]">
                  Clinical access restricted — contact your administrator.
                </p>
              ) : patient.medical_history ? (
                <p className="text-sm text-[#3D3A38] whitespace-pre-wrap">{patient.medical_history}</p>
              ) : (
                <p className="text-sm italic text-[#9C9490]">No medical history recorded</p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Appointments ────────────────────────────────────────── */}
        <TabsContent value="appointments">
          <div className="rounded-xl border border-[#E2D9D0] bg-white p-6">
            <AppointmentsTab patientId={patient.id} patientName={patient.full_name} />
          </div>
        </TabsContent>

        {/* ── Documents ───────────────────────────────────────────── */}
        <TabsContent value="documents">
          <div className="rounded-xl border border-[#E2D9D0] bg-white p-6">
            <DocumentsSection patientId={patient.id} />
          </div>
        </TabsContent>

        {/* ── Family ──────────────────────────────────────────────── */}
        <TabsContent value="family">
          <div className="rounded-xl border border-[#E2D9D0] bg-white p-6">
            <FamilyTab patient={patient} />
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Edit Dialog ────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Patient</DialogTitle>
            <DialogDescription>Update {patient.full_name}'s information.</DialogDescription>
          </DialogHeader>
          {updateMutation.isError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {updateMutation.error instanceof Error
                ? updateMutation.error.message
                : "Update failed"}
            </div>
          )}
          <PatientForm
            defaultValues={{
              full_name:       patient.full_name,
              date_of_birth:   patient.date_of_birth,
              gender:          patient.gender,
              phone:           patient.phone,
              email:           patient.email,
              address:         patient.address,
              blood_group:     patient.blood_group,
              allergies:       patient.allergies ?? "",
              medical_history: patient.medical_history ?? "",
            }}
            onSubmit={async (values) => { await updateMutation.mutateAsync(values); }}
            submitLabel="Save Changes"
            isEditing
          />
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ─────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Patient</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{" "}
              <strong>{patient.full_name}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
