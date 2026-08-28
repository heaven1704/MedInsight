"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import type { Family, PatientListItem } from "@/types";
import { PatientPicker } from "@/components/patients/PatientPicker";

export default function FamilyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const client = useQueryClient();
  const { data: family } = useQuery({ queryKey: ["family", id], queryFn: () => api.get<Family>(`/api/families/${id}/`) });
  const { data: members = [] } = useQuery({ queryKey: ["family-members", id], queryFn: () => api.get<PatientListItem[]>(`/api/families/${id}/members/`) });
  const addMember = useMutation({
    mutationFn: (patientId: number) => api.post(`/api/families/${id}/add-member/`, { patient_id: patientId }),
    onSuccess: () => { client.invalidateQueries({ queryKey: ["family", id] }); client.invalidateQueries({ queryKey: ["family-members", id] }); client.invalidateQueries({ queryKey: ["families"] }); },
  });

  return (
    <div className="space-y-6">
      <Link href="/families" className="flex items-center gap-1.5 text-sm text-[#9C9490] hover:text-[#3D3A38]"><ArrowLeft className="h-4 w-4" />All Families</Link>
      <div><h1 className="text-2xl font-semibold text-[#3D3A38]">{family?.family_name ?? "Family"}</h1><p className="mt-1 text-sm text-[#9C9490]">{members.length} member{members.length === 1 ? "" : "s"}</p></div>
      <div className="rounded-xl border border-[#E2D9D0] bg-white p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#3D3A38]"><UserPlus className="h-4 w-4 text-[#C1674F]" />Add Patient</h2>
        <PatientPicker value={null} onChange={(patientId) => addMember.mutate(patientId)} placeholder="Search a patient to add…" />
        {addMember.isError && <p className="mt-2 text-sm text-red-700">Could not add that patient.</p>}
      </div>
      <div className="space-y-2">{members.map((member) => <Link key={member.id} href={`/patients/${member.id}`} className="flex items-center justify-between rounded-lg border border-[#E2D9D0] bg-white px-4 py-3 hover:bg-[#FAF7F2]"><span className="font-medium text-[#3D3A38]">{member.full_name}</span><span className="text-sm text-[#9C9490]">{member.phone || "No phone"}</span></Link>)}</div>
    </div>
  );
}
