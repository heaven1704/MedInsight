"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Home, Plus } from "lucide-react";
import { api } from "@/lib/api";
import type { Family } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function FamiliesPage() {
  const client = useQueryClient();
  const [name, setName] = useState("");
  const { data: families = [], isLoading } = useQuery({
    queryKey: ["families"],
    queryFn: () => api.get<Family[]>("/api/families/"),
  });
  const create = useMutation({
    mutationFn: () => api.post<Family>("/api/families/", { family_name: name }),
    onSuccess: () => { setName(""); client.invalidateQueries({ queryKey: ["families"] }); },
  });

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold text-[#3D3A38]">Families</h1><p className="mt-1 text-sm text-[#9C9490]">Manage patient family groups.</p></div>
      <form onSubmit={(event) => { event.preventDefault(); if (name.trim()) create.mutate(); }} className="flex max-w-lg gap-2">
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Family name" aria-label="Family name" />
        <Button type="submit" disabled={!name.trim() || create.isPending}><Plus className="h-4 w-4" />Create Family</Button>
      </form>
      {isLoading ? <p className="text-sm text-[#9C9490]">Loading families…</p> : families.length === 0 ? (
        <div className="rounded-xl border border-[#E2D9D0] bg-white py-12 text-center"><Home className="mx-auto h-8 w-8 text-[#C8BFBA]" /><p className="mt-3 text-sm text-[#6B6460]">No family groups yet.</p></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {families.map((family) => <Link key={family.id} href={`/families/${family.id}`} className="rounded-xl border border-[#E2D9D0] bg-white p-5 transition-colors hover:bg-[#FAF7F2]"><p className="font-medium text-[#3D3A38]">{family.family_name}</p><p className="mt-1 text-sm text-[#9C9490]">{family.member_count} member{family.member_count === 1 ? "" : "s"}</p></Link>)}
        </div>
      )}
    </div>
  );
}
