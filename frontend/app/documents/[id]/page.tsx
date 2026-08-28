"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Loader2, ScanText } from "lucide-react";
import { api } from "@/lib/api";
import type { Document } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

const TYPE_LABELS: Record<string, string> = {
  prescription: "Prescription",
  lab_report: "Lab Report",
  invoice: "Invoice",
  medical_record: "Medical Record",
  other: "Other",
};

const STATUS_LABELS: Record<string, string> = {
  uploaded: "Uploaded",
  processing: "Processing",
  processed: "Processed",
  needs_review: "Needs review",
};

function isImageFile(url: string) {
  return /\.(jpe?g|png)(\?|$)/i.test(url);
}

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [extractedName, setExtractedName] = useState("");
  const [extractedDate, setExtractedDate] = useState("");
  const [extractedAge, setExtractedAge] = useState("");
  const [extractedMedicines, setExtractedMedicines] = useState("[]");
  const [extractedAmount, setExtractedAmount] = useState("");
  const [applyMessage, setApplyMessage] = useState<string | null>(null);

  const { data: doc, isLoading, isError } = useQuery({
    queryKey: ["document", params.id],
    queryFn: () => api.get<Document>(`/api/documents/${params.id}/`),
  });

  // The query result hydrates editable review fields once it arrives.
  useEffect(() => {
    if (!doc) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setExtractedName(doc.extracted_name ?? "");
    setExtractedDate(doc.extracted_date ?? "");
    setExtractedAge(doc.extracted_age == null ? "" : String(doc.extracted_age));
    setExtractedMedicines(JSON.stringify(doc.extracted_medicines ?? [], null, 2));
    setExtractedAmount(doc.extracted_amount ?? "");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [doc]);

  const ocrMutation = useMutation({
    mutationFn: async () => {
      const result = await api.post<Document>(`/api/documents/${params.id}/run-ocr/`, {});
      if (result.processing_status === "needs_review") {
        throw new Error("OCR unavailable, try again");
      }
      return result;
    },
    onSuccess: (result) => {
      setOcrError(null);
      queryClient.setQueryData(["document", params.id], result);
      queryClient.invalidateQueries({ queryKey: ["patient-documents"] });
    },
    onError: () => {
      setOcrError("OCR unavailable, try again");
    },
  });

  const applyMutation = useMutation({
    mutationFn: () => api.patch(`/api/patients/${doc?.patient}/`, {
      full_name: extractedName,
      date_of_birth: extractedDate || null,
    }),
    onSuccess: () => setApplyMessage("Patient record updated with the confirmed extracted details."),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (isError || !doc) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-[#9C9490] hover:text-[#3D3A38] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <p className="text-sm text-[#6B6460]">This document could not be loaded.</p>
      </div>
    );
  }

  const typeLabel = TYPE_LABELS[doc.document_type] ?? doc.document_type;
  const running = ocrMutation.isPending;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-[#9C9490] hover:text-[#3D3A38] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <Link href="/documents" className="text-sm text-[#C1674F] hover:underline">
          All documents
        </Link>
      </div>

      <div className="rounded-2xl border border-[#E2D9D0] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#C1674F]/10 text-[#C1674F]">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[#3D3A38]">{typeLabel}</h1>
              <p className="mt-1 text-sm text-[#9C9490]">
                Uploaded {formatDate(doc.uploaded_at)}
                {doc.tags ? ` · ${doc.tags}` : ""}
              </p>
              <div className="mt-2">
                <Badge
                  variant={
                    doc.processing_status === "processed"
                      ? "success"
                      : doc.processing_status === "needs_review"
                        ? "default"
                        : "muted"
                  }
                >
                  {STATUS_LABELS[doc.processing_status] ?? doc.processing_status.replace("_", " ")}
                </Badge>
              </div>
            </div>
          </div>
          <Button onClick={() => ocrMutation.mutate()} disabled={running}>
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running OCR…
              </>
            ) : (
              <>
                <ScanText className="h-4 w-4" />
                Run OCR
              </>
            )}
          </Button>
        </div>
      </div>

      {doc.file && (
        <div className="rounded-xl border border-[#E2D9D0] bg-white p-4">
          <p className="mb-3 text-sm font-medium text-[#3D3A38]">File</p>
          {isImageFile(doc.file) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={doc.file}
              alt={typeLabel}
              className="max-h-80 rounded-lg border border-[#E2D9D0] object-contain"
            />
          ) : (
            <a
              href={doc.file}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-[#C1674F] hover:underline"
            >
              Open original file
            </a>
          )}
        </div>
      )}

      <div className="rounded-xl border border-[#E2D9D0] bg-white p-6">
        <h2 className="text-sm font-semibold text-[#3D3A38]">Structured OCR review</h2>
        {running && (
          <div className="mt-4 flex items-center gap-2 text-sm text-[#6B6460]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Reading the document… this can take a minute on first run.
          </div>
        )}
        {!running && (ocrError || doc.processing_status === "needs_review") && (
          <p className="mt-4 rounded-md bg-[#C1674F]/10 px-3 py-2 text-sm text-[#A8523C]">
            OCR unavailable, try again
          </p>
        )}
        {!running && !ocrError && doc.processing_status === "processed" && (
          <div className="mt-4 space-y-4">
            {doc.auto_update_message && (
              <p className="rounded-md bg-[#6B8F71]/10 px-3 py-2 text-sm text-[#3D3A38]">{doc.auto_update_message}</p>
            )}
            {applyMessage && <p className="rounded-md bg-[#6B8F71]/10 px-3 py-2 text-sm text-[#3D3A38]">{applyMessage}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-[#6B6460]">Name<Input value={extractedName} onChange={(event) => setExtractedName(event.target.value)} /></label>
              <label className="space-y-1 text-xs text-[#6B6460]">Date<Input type="date" value={extractedDate} onChange={(event) => setExtractedDate(event.target.value)} /></label>
              <label className="space-y-1 text-xs text-[#6B6460]">Age<Input type="number" value={extractedAge} onChange={(event) => setExtractedAge(event.target.value)} /></label>
              <label className="space-y-1 text-xs text-[#6B6460]">Amount<Input value={extractedAmount} onChange={(event) => setExtractedAmount(event.target.value)} /></label>
            </div>
            <label className="block space-y-1 text-xs text-[#6B6460]">Medicines (JSON)
              <textarea value={extractedMedicines} onChange={(event) => setExtractedMedicines(event.target.value)} rows={5} className="w-full rounded-md border border-[#E2D9D0] p-3 font-mono text-sm" />
            </label>
            <Button
              variant="outline"
              disabled={!extractedName || applyMutation.isPending}
              onClick={() => {
                if (window.confirm("Apply the confirmed name and date to this patient record?")) applyMutation.mutate();
              }}
            >
              Apply to patient record
            </Button>
          </div>
        )}
        {!running && !ocrError && doc.processing_status === "processed" && !doc.extracted_text && (
          <p className="mt-4 text-sm text-[#9C9490]">
            OCR finished, but no text was found in this file.
          </p>
        )}
        {!running && !ocrError && doc.processing_status !== "processed" && doc.processing_status !== "needs_review" && !doc.extracted_text && (
          <p className="mt-4 text-sm text-[#9C9490]">
            No text yet. Click Run OCR to extract text from this file.
          </p>
        )}
      </div>
    </div>
  );
}
