"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ingestDocument, runExtraction } from "@/lib/policy-watch/actions";
import { PLAN_TYPES } from "@/lib/admin/schemas";

export default function IngestDocumentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setStatus("Ingesting document...");

    const formData = new FormData(e.currentTarget);
    const sourceUrl = formData.get("source_url") as string;
    const sourceText = formData.get("source_text") as string;
    const payerNameHint = (formData.get("payer_name_hint") as string) || undefined;
    const planTypeHint = (formData.get("plan_type_hint") as string) || undefined;

    // Step 1: Ingest
    const ingestResult = await ingestDocument({
      source_url: sourceUrl,
      source_text: sourceText,
      payer_name_hint: payerNameHint,
      plan_type_hint: planTypeHint,
    });

    if (!ingestResult.success) {
      setError(ingestResult.error ?? "Ingestion failed");
      setLoading(false);
      setStatus("");
      return;
    }

    const documentId = ingestResult.data!.document_id;

    // Step 2: Run extraction
    setStatus("Extracting rules with Claude AI... This may take 15-30 seconds.");
    const extractResult = await runExtraction(documentId);

    if (!extractResult.success) {
      setError(extractResult.error ?? "Extraction failed");
      setLoading(false);
      setStatus("");
      // Still redirect so they can see the failed document
      router.push(`/admin/policy-watch/${documentId}`);
      return;
    }

    setStatus(
      `Extraction complete! ${extractResult.data!.rules_count} rules staged for review.`
    );

    // Redirect to document detail
    setTimeout(() => {
      router.push(`/admin/policy-watch/${documentId}`);
    }, 1000);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Ingest Coverage Policy</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Paste the text content of a payer coverage policy document. Claude AI will
        extract structured PA rules for your review.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label
            htmlFor="source_url"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Source URL *
          </label>
          <input
            type="url"
            id="source_url"
            name="source_url"
            required
            placeholder="https://www.uhcprovider.com/content/dam/..."
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <p className="mt-1 text-xs text-zinc-500">
            URL of the payer coverage policy PDF or web page.
          </p>
        </div>

        <div>
          <label
            htmlFor="payer_name_hint"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Payer Name (hint)
          </label>
          <input
            type="text"
            id="payer_name_hint"
            name="payer_name_hint"
            placeholder="UnitedHealthcare"
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div>
          <label
            htmlFor="plan_type_hint"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Plan Type (hint)
          </label>
          <select
            id="plan_type_hint"
            name="plan_type_hint"
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">— Auto-detect —</option>
            {PLAN_TYPES.map((pt) => (
              <option key={pt} value={pt}>
                {pt}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="source_text"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Document Text *
          </label>
          <textarea
            id="source_text"
            name="source_text"
            required
            rows={20}
            placeholder="Paste the full text of the payer coverage policy here..."
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <p className="mt-1 text-xs text-zinc-500">
            Paste the relevant sections of the coverage policy. Max 100,000 characters.
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {status && !error && (
          <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
            {status}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading ? "Processing..." : "Extract Rules"}
        </button>
      </form>
    </div>
  );
}
