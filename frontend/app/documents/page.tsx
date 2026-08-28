"use client";

import DocumentsSection from "@/components/documents/DocumentsSection";

export default function DocumentsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-xl font-semibold">Documents</h1>
      <div className="rounded-xl border border-[#E2D9D0] bg-white p-6">
        <DocumentsSection />
      </div>
    </div>
  );
}
