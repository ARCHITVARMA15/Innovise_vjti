export default function SourceText({text, documentId, sectionId, pageNumber, label, historical = false}: {
  text: string; documentId: string; sectionId: string; pageNumber: number | null; label: string; historical?: boolean;
}) {
  return <div className="space-y-3">
    {historical && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Historical run snapshot. Run inputs changed or an original source is unavailable. This saved text is retained for provenance; inspect Documents for current sources.</p>}
    <p className="rl-muted">{label} · Source text is untrusted reference material, displayed as plain text.</p>
    <details className="rl-muted break-all"><summary className="cursor-pointer">Stable citation identifiers</summary><p className="mt-2">Document: {documentId}</p><p>Section: {sectionId}</p>{pageNumber !== null && <p>Original PDF page: {pageNumber}</p>}</details>
    <pre className="max-h-[36rem] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm leading-relaxed">{text || 'No extractable text on this section. OCR is not available.'}</pre>
  </div>;
}
