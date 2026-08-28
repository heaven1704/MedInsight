import DocumentsSection from "@/components/documents/DocumentsSection";

export default function DocumentsPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#3D3A38]">Documents</h1>
        <p className="mt-0.5 text-sm text-[#9C9490]">
          Upload patient documents and extract text with OCR
        </p>
      </div>
      <div className="rounded-xl border border-[#E2D9D0] bg-white p-6">
        <DocumentsSection />
      </div>
    </>
  );
}
