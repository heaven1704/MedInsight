"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { api } from "@/lib/api";
import type { PaginatedResponse, PatientListItem } from "@/types";
import { useDebounce } from "@/lib/useDebounce";
import { Input } from "@/components/ui/input";

interface PatientPickerProps {
  value: number | null;
  onChange: (id: number, name: string) => void;
  locked?: boolean;
  lockedName?: string;
  placeholder?: string;
}

export function PatientPicker({
  value,
  onChange,
  locked = false,
  lockedName,
  placeholder = "Search patient...",
}: PatientPickerProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedName, setSelectedName] = useState(lockedName ?? "");
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ["patients-picker", debouncedSearch],
    queryFn: () => api.get<PaginatedResponse<PatientListItem>>(
      `/api/patients/?search=${encodeURIComponent(debouncedSearch)}&page_size=100`
    ),
    enabled: open && !locked,
  });

  if (locked) {
    return (
      <div className="flex h-9 items-center rounded-md border border-[#E2D9D0] bg-[#F2EDE4] px-3 text-sm text-[#6B6460]">
        {lockedName ?? "Patient"}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        data-selected={value ?? undefined}
        className="flex h-9 w-full cursor-pointer items-center rounded-md border border-[#E2D9D0] bg-white px-3 text-left text-sm text-[#3D3A38] hover:border-[#C1674F]"
        onClick={() => setOpen((current) => !current)}
      >
        {selectedName || <span className="text-[#9C9490]">{placeholder}</span>}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-[#E2D9D0] bg-white shadow-lg">
          <div className="relative border-b border-[#F2EDE4] p-2">
            <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9C9490]" />
            <Input
              autoFocus
              placeholder="Type name or phone..."
              className="h-8 pl-7 text-xs"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="h-44 overflow-y-auto py-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-[#9C9490]" /></div>
            ) : (data?.results ?? []).length === 0 ? (
              <p className="px-3 py-3 text-center text-xs text-[#9C9490]">No patients found</p>
            ) : (
              (data?.results ?? []).map((patient) => (
                <button
                  key={patient.id}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#F2EDE4]"
                  onClick={() => {
                    onChange(patient.id, patient.full_name);
                    setSelectedName(patient.full_name);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <span className="font-medium text-[#3D3A38]">{patient.full_name}</span>
                  <span className="text-xs text-[#9C9490]">{patient.phone || "No phone"}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
