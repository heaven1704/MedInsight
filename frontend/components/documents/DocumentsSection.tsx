"use client";

import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getAccessToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

export default function DocumentsSection({ patientId }: { patientId?: number | string }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("other");
  const [tags, setTags] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<string | number | undefined>(patientId ?? undefined);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { data: patients } = useQuery({
    queryKey: ["patients-list"],
    queryFn: () => api.get(`/api/patients/?page_size=200`).then((r) => (r as any).results ?? r),
  });

  const { data: documents } = useQuery({
    queryKey: ["patient-documents", selectedPatient],
    queryFn: () => {
      const qs = selectedPatient ? `?patient=${selectedPatient}` : "";
      return api.get(`/api/documents/${qs}`);
    },
    enabled: !!selectedPatient,
  });

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
    onError: (err: any) => setError(err?.message ?? "Upload failed"),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Select
          value={String(selectedPatient ?? "")}
          onValueChange={(v) => setSelectedPatient(v ? Number(v) : undefined)}
        >
          <SelectTrigger className="h-9 w-56 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Select patient</SelectItem>
            {(patients ?? []).map((p: any) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={docType} onValueChange={(v) => setDocType(v)}>
          <SelectTrigger className="h-9 w-44 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="prescription">Prescription</SelectItem>
            <SelectItem value="lab_report">Lab Report</SelectItem>
            <SelectItem value="invoice">Invoice</SelectItem>
            <SelectItem value="medical_record">Medical Record</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>

        <Input placeholder="tags (comma separated)" value={tags} onChange={(e) => setTags(e.target.value)} />

        <input ref={inputRef} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />

        <Button onClick={() => uploadMutation.mutate()} disabled={uploadMutation.isLoading}>
          {uploadMutation.isLoading ? <Loader2 className="animate-spin h-4 w-4" /> : "Upload"}
        </Button>
      </div>

      {error && <div className="text-sm text-red-700">{error}</div>}

      <div className="space-y-2">
        {(documents?.results ?? documents ?? []).map((d: any) => (
          <div key={d.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div>
              <div className="text-sm font-medium">{d.document_type.replace("_", " ")}</div>
              <div className="text-xs text-gray-500">{d.tags}</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-600">{new Date(d.uploaded_at).toLocaleString()}</div>
              <Badge>{d.processing_status}</Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
