"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Plus, Search, Users, ChevronLeft, ChevronRight, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import type { PaginatedResponse, PatientListItem, PatientFormValues } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { PatientForm, type PatientFormSchema } from "@/components/patients/PatientForm";
import { formatDate, getInitials } from "@/lib/utils";
import { useDebounce } from "@/lib/useDebounce";

const PAGE_SIZE = 20;

// ── Gender badge colours ───────────────────────────────────────────────────
const genderVariant = {
  male:   "outline",
  female: "default",
  other:  "muted",
} as const;

// ── Skeleton row ──────────────────────────────────────────────────────────
function PatientRowSkeleton() {
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
function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <tr>
      <td colSpan={5}>
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F2EDE4]">
            <Users className="h-7 w-7 text-[#C8BFBA]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#3D3A38]">
              {hasSearch ? "No patients match your search" : "No patients yet"}
            </p>
            <p className="mt-1 text-xs text-[#9C9490]">
              {hasSearch
                ? "Try a different name or phone number"
                : "Add your first patient to get started"}
            </p>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function PatientsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [search, setSearch]     = useState("");
  const [page, setPage]         = useState(1);
  const [addOpen, setAddOpen]   = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  // ── Query ─────────────────────────────────────────────────────────────
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["patients", debouncedSearch, page],
    queryFn: () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("page", String(page));
      params.set("page_size", String(PAGE_SIZE));
      return api.get<PaginatedResponse<PatientListItem>>(
        `/api/patients/?${params.toString()}`
      );
    },
  });

  // Reset to page 1 when search changes
  const handleSearch = useCallback((v: string) => {
    setSearch(v);
    setPage(1);
  }, []);

  // ── Create mutation ───────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (values: PatientFormSchema) =>
      api.post("/api/patients/", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      setAddOpen(false);
    },
  });

  const totalPages = data ? Math.ceil(data.count / PAGE_SIZE) : 1;
  const patients   = data?.results ?? [];

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#3D3A38]">Patients</h1>
          {data && (
            <p className="mt-0.5 text-sm text-[#9C9490]">
              {data.count} {data.count === 1 ? "patient" : "patients"} total
            </p>
          )}
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Patient
        </Button>
      </div>

      {/* ── Search ─────────────────────────────────────────────────── */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9C9490]" />
        <Input
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* ── Error ──────────────────────────────────────────────────── */}
      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error instanceof Error ? error.message : "Failed to load patients"}
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-[#E2D9D0] bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#F2EDE4] bg-[#FAF7F2]">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#9C9490]">Patient</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#9C9490]">Phone</th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#9C9490] sm:table-cell">Gender</th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#9C9490] md:table-cell">Last Visit</th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#9C9490] lg:table-cell">Family</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? [...Array(8)].map((_, i) => <PatientRowSkeleton key={i} />)
              : patients.length === 0
              ? <EmptyState hasSearch={!!debouncedSearch} />
              : patients.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/patients/${p.id}`)}
                    className="cursor-pointer border-b border-[#F2EDE4] transition-colors hover:bg-[#FAF7F2] last:border-0"
                  >
                    {/* Name + avatar */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#C1674F]/10 text-xs font-semibold text-[#C1674F]">
                          {getInitials(p.full_name)}
                        </div>
                        <div>
                          <p className="font-medium text-[#3D3A38]">{p.full_name}</p>
                          <p className="text-xs text-[#9C9490]">{formatDate(p.date_of_birth)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#6B6460]">{p.phone}</td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <Badge variant={genderVariant[p.gender] as "outline" | "default" | "muted"}>
                        {p.gender}
                      </Badge>
                    </td>
                    <td className="hidden px-4 py-3 text-[#9C9490] md:table-cell">
                      {p.last_visit ? formatDate(p.last_visit) : <span className="italic">No visits</span>}
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      {p.family_name ? (
                        <span className="inline-flex items-center gap-1 text-xs text-[#6B8F71]">
                          <UserRound className="h-3 w-3" />
                          {p.family_name}
                        </span>
                      ) : (
                        <span className="text-xs text-[#C8BFBA]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ─────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-[#9C9490]">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Add Patient Dialog ──────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Patient</DialogTitle>
            <DialogDescription>Fill in the patient details below. Fields marked * are required.</DialogDescription>
          </DialogHeader>
          {createMutation.isError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : "Failed to create patient"}
            </div>
          )}
          <PatientForm
            onSubmit={async (values) => { await createMutation.mutateAsync(values); }}
            submitLabel="Add Patient"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
