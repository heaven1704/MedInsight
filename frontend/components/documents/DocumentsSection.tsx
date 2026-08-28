"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, UploadCloud, FolderOpen } from "lucide-react";
import { api, getAccessToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import type { Document, DocumentType, PatientListItem, PaginatedResponse } from "@/types";

// ── Labels / status styling (consistent with the dashboard) ────────────────

const TYPE_LABELS: Record<string, string> = {
  prescription: "Prescription",
  lab_report: "Lab Report",
  invoice: "Invoice",
  medical_record: "Medical Record",
  other: "Other",
};

const DOC_STATUS_CONFIG: Record<
  Document["processing_status"],
  { label: string; variant: "default" | "success" | "outline" | "muted" }
> = {
  uploaded:     { label: "Uploaded",     variant: "muted" },
  processing:   { label: "Processing",   variant: "default" },
  processed:    { label: "OCR done",     variant: "success" },
  needs_review: { label: "Needs review", variant: "outline" },
};

function typeLabel(t: DocumentType | string): string {
  return TYPE_LABELS[t] ?? t.replace("_", " ");
}

function DocumentRowSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[#F2EDE4] px-3 py-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
      <Skeleton className="h-5 w-20" />
    </div>
  );
}

export default function DocumentsSection({ patientId }: { patientId?: number | string }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocumentType>("other");
  const [tags, setTags] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<string | number | undefined>(patientId ?? undefined);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { data: patients } = useQuery({
    queryKey: ["patients-list"],
    queryFn: () =>
      api.get<PaginatedResponse<PatientListItem>>("/api/patients/?page_size=200")
        .then((r) => r.results ?? []),
  });

  const {
    data: documents,
    isLoading: docsLoading,
    isError: docsError,
  } = useQuery({
    queryKey: ["patient-documents", selectedPatient],
    queryFn: () => {
      const qs = selectedPatient ? `?patient=${selectedPatient}` : "";
      return api.get<{ results: Document[] } | Document[]>(`/api/documents/${qs}`)
        .then((r) => (Array.isArray(r) ? r : r.results ?? []));
    },
    enabled: !!selectedPatient,
  });

  const docList = documents ?? [];

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected.");
      if (!selectedPatient) throw new Error("Select a patient.");

      const fd = new FormData();
      fd.append("file", file);
      fd.append("patient", String(selectedPatient));
      fd.append("document_type", docType);
      fd.append("tags", tags);

      const token = getAccessToken();
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000") + "/api/documents/", {
        method: "POST",
        body: fd,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!res.ok) {
        let msg = `Upload failed (${res.status})`;
        try {
          const body = await res.json();
          msg = body?.file?.[0] ?? body?.detail ?? JSON.stringify(body);
        } catch {}
        throw new Error(msg);
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-documents", selectedPatient] });
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setTags("");
      setError(null);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Upload failed"),
  });

  return (
    <div className="space-y-5">
      {/* ── Upload controls ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={String(selectedPatient ?? "")}
          onValueChange={(v) => setSelectedPatient(v ? Number(v) : undefined)}
        >
          <SelectTrigger className="h-9 w-52 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Select patient</SelectItem>
            {(patients ?? []).map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={docType} onValueChange={(v) => setDocType(v as DocumentType)}>
          <SelectTrigger className="h-9 w-44 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Tags (comma separated)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="h-9 w-56 text-sm"
        />

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="h-9 w-56 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#F2EDE4] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[#3D3A38] hover:file:bg-[#E2D9D0]"
        />

        <Button onClick={() => uploadMutation.mutate()} disabled={uploadMutation.isPending} className="min-w-[110px]">
          {uploadMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <UploadCloud className="h-4 w-4" />
              Upload
            </>
          )}
        </Button>
      </div>

      {/* ── Upload error ────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Document list ───────────────────────────────────────────── */}
      {docsLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <DocumentRowSkeleton key={i} />)}
        </div>
      ) : docsError ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <FolderOpen className="h-7 w-7 text-red-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#3D3A38]">Couldn&apos;t load documents</p>
            <p className="mt-1 text-xs text-[#9C9490]">
              The document list failed to load. Please try again.
            </p>
          </div>
        </div>
      ) : docList.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F2EDE4]">
            <FileText className="h-7 w-7 text-[#C8BFBA]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#3D3A38]">No documents yet</p>
            <p className="mt-1 text-xs text-[#9C9490]">
              {selectedPatient
                ? "Upload this patient's first document to get started."
                : "Select a patient, then upload a document to get started."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {docList.map((d) => {
            const cfg = DOC_STATUS_CONFIG[d.processing_status];
            return (
              <Link
                key={d.id}
                href={`/documents/${d.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-[#E2D9D0] px-3 py-2.5 transition-colors hover:bg-[#FAF7F2]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#6B8F71]/10">
                    <FileText className="h-4 w-4 text-[#6B8F71]" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#3D3A38]">{typeLabel(d.document_type)}</p>
                    <p className="truncate text-xs text-[#9C9490]">
                      {formatDate(d.uploaded_at)}
                      {d.tags ? ` · ${d.tags}` : ""}
                    </p>
                  </div>
                </div>
                <Badge variant={cfg?.variant ?? "muted"} className="flex-shrink-0">
                  {cfg?.label ?? d.processing_status.replace("_", " ")}
                </Badge>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
