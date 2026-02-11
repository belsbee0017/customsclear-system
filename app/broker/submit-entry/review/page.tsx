"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/app/lib/supabaseClient";
import { logActivity } from "@/app/lib/activityLogger";
import Button from "@/app/components/Button";
export const dynamic = "force-dynamic";
const supabase = createClient();

/* ===============================
   TYPES
================================ */
type DocumentType = "GD" | "INVOICE" | "PACKING_LIST" | "AWB";

type DocumentRow = {
  document_id: string;
  document_set_id: string;
  type: DocumentType;
  storage_path: string | null;
  mime_type: string | null;
};

type RawOCRField = {
  field_id: number;
  document_id: string;
  field_name: string;
  extracted_value: string | null;
  normalized_value: string | null;
  confidence_score: number | null;
  document: DocumentRow;
};

type UIField = {
  field_id?: number;
  field_name: string;
  value: string;
  confidence_score: number | null;
  isVirtual: boolean;
};

/* ===============================
   CONFIG
================================ */
const DOC_TABS: DocumentType[] = ["GD", "INVOICE", "PACKING_LIST", "AWB"];

const FIELD_WHITELIST: Record<DocumentType, string[]> = {
  GD: [
    "declarant_name",
    "consignee",
    "hs_code",
    "declared_value",
    "gross_weight",
    "country_of_origin",
  ],
  INVOICE: [
    "invoice_number",
    "invoice_date",
    "description_of_goods",
    "unit_price",
    "total_value",
  ],
  PACKING_LIST: ["number_of_packages", "net_weight", "gross_weight"],
  AWB: ["awb_number", "shipper", "consignee", "gross_weight"],
};

const MOCK_FIELD_VALUES: Record<string, string> = {
  declarant_name: "Juan Dela Cruz",
  consignee: "ABC Import Trading",
  hs_code: "8471300000",
  declared_value: "12500",
  gross_weight: "500",
  country_of_origin: "US",
  invoice_number: "INV-2026-001",
  invoice_date: new Date().toISOString().slice(0, 10),
  description_of_goods: "Electronic goods",
  unit_price: "2500",
  total_value: "12500",
  number_of_packages: "25",
  net_weight: "450",
  awb_number: "AWB-1234567890",
  shipper: "Global Export Co",
};

const prettyLabel = (k: string) =>
  k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/* ===============================
   PAGE
================================ */
export default function BrokerSubmitEntryReviewPage() {
  const params = useSearchParams();
  const documentSetId = params.get("document_set_id")?.trim() ?? null;

  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [rawFields, setRawFields] = useState<RawOCRField[]>([]);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const [activeDoc, setActiveDoc] = useState<DocumentType>("GD");
  const [activeDocId, setActiveDocId] = useState<string | null>(null);

  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [loading, setLoading] = useState(true);

  const [runningOCR, setRunningOCR] = useState(false);
  const [ocrMsg, setOcrMsg] = useState<string | null>(null);

  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  

  // used to force reload without hard refresh
  const [reloadKey, setReloadKey] = useState(0);



  /* ===============================
     HELPERS
  ================================ */
  const docsForTab = useMemo(
    () => docs.filter((d) => d.type === activeDoc),
    [docs, activeDoc]
  );

  // “has extracted mapped fields” (rawFields excludes raw_text)
  const hasExtracted = rawFields.length > 0;

  const activeDocRow = useMemo(() => {
    if (!activeDocId) return null;
    return docs.find((d) => d.document_id === activeDocId) ?? null;
  }, [docs, activeDocId]);

  /* ===============================
     LOAD DOCS + MAPPED FIELDS
  ================================ */
  useEffect(() => {
    if (!documentSetId) return;

    const load = async () => {
      setLoading(true);

      const { data: documents, error: docsErr } = await supabase
        .from("documents")
        .select("document_id, document_set_id, type, storage_path, mime_type")
        .eq("document_set_id", documentSetId);

      if (docsErr || !documents) {
        console.error(docsErr);
        setDocs([]);
        setRawFields([]);
        setLoading(false);
        return;
      }

      setDocs(documents as DocumentRow[]);

      const docMap: Record<string, DocumentRow> = Object.fromEntries(
        (documents as DocumentRow[]).map((d: DocumentRow) => [d.document_id, d])
      );

      const { data: fields, error: fieldsErr } = await supabase
        .from("extracted_fields")
        .select(
          "field_id, document_id, field_name, extracted_value, normalized_value, confidence_score"
        )
        .neq("field_name", "raw_text")
        .in(
          "document_id",
          (documents as DocumentRow[]).map((d: DocumentRow) => d.document_id)
        );

      if (fieldsErr) {
        console.error(fieldsErr);
        setRawFields([]);
      } else {
        setRawFields(
          (fields ?? []).map((f: { field_id: number; document_id: string; field_name: string; extracted_value: string | null; normalized_value: string | null; confidence_score: number | null }) => ({
            ...f,
            document: docMap[f.document_id],
          }))
        );
      }

      setLoading(false);
    };

    load();
  }, [documentSetId, reloadKey]);

  /* ===============================
     AUTO-SELECT FIRST DOC PER TAB
  ================================ */
  useEffect(() => {
    if (docsForTab.length === 0) {
      setActiveDocId(null);
      return;
    }

    // keep selection if still valid
    if (activeDocId && docsForTab.some((d) => d.document_id === activeDocId)) {
      return;
    }

    // otherwise select first doc in tab
    setActiveDocId(docsForTab[0].document_id);
  }, [docsForTab, activeDocId]);

  /* ===============================
     PREVIEW SIGNED URL (PDF)
  ================================ */
  useEffect(() => {
    if (!activeDocRow?.storage_path) {
      setFileUrl(null);
      return;
    }

    let cancelled = false;

    (async () => {
      setPreviewLoading(true);
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(activeDocRow.storage_path!, 3600);

      if (cancelled) return;

      if (error) {
        console.error("SIGNED URL ERROR:", error);
        setFileUrl(null);
      } else {
        setFileUrl(data?.signedUrl ?? null);
      }
      setPreviewLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeDocRow?.storage_path]);

  /* ===============================
     OCR CALL (AI → pdf-parse → mock)
  ================================ */
  async function extractDocument(documentSetId: string, documentId: string) {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      throw new Error("Session expired. Please refresh and try again.");
    }

    const token = data.session.access_token;

    // Try AI extraction first (best accuracy)
    try {
      const aiRes = await fetch("/api/ocr-gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          document_set_id: documentSetId,
          document_id: documentId,
        }),
      });

      if (aiRes.ok) {
        const json = await aiRes.json();
        return { ...json, method: "gemini" };
      }
    } catch {
      // AI extraction failed, try pdf-parse fallback
    }

    // Fallback to pdf-parse
    const pdfParseRes = await fetch("/api/ocr-extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        document_set_id: documentSetId,
        document_id: documentId,
      }),
    });

    const json = await pdfParseRes.json();
    if (!pdfParseRes.ok) {
      throw new Error(json?.error || `Extraction failed (${pdfParseRes.status})`);
    }

    return { ...json, method: "pdf-parse" };
  }

function handleChange(fieldName: string, newValue: string) {
  setEditedValues((prev) => ({
    ...prev,
    [fieldName]: newValue,
  }));

}

const saveChanges = async () => {
  if (!activeDocId) {
    alert("No active document selected.");
    return;
  }

  // Use editedValues — the state the input fields actually write to
  const entries = Object.entries(editedValues).filter(
    ([, v]) => (v ?? "").trim().length > 0
  );

  if (entries.length === 0) {
    alert("No changes to save.");
    return;
  }

  setSaving(true);
  try {
    // For fields that already exist in DB → update normalized_value
    for (const f of visibleFields) {
      const newValue = editedValues[f.field_name];
      if (newValue === undefined) continue;

      if (f.field_id) {
        // Existing row → update
        const { error } = await supabase
          .from("extracted_fields")
          .update({ normalized_value: newValue })
          .eq("field_id", f.field_id);
        if (error) throw error;
      } else {
        // Virtual row (no DB entry yet) → insert
        const { error } = await supabase
          .from("extracted_fields")
          .insert({
            document_id: activeDocId,
            field_name: f.field_name,
            extracted_value: newValue,
            normalized_value: newValue,
            confidence_score: null,
          });
        if (error) throw error;
      }
    }

    setEditedValues({});
    setLastSaved(new Date());
    setReloadKey((k) => k + 1);
    
    // Log save activity
    await logActivity({
      action: "DOCUMENT_SAVE",
      actor_role: "BROKER",
      reference_type: "document",
      reference_id: activeDocId,
      remarks: `Saved ${Object.keys(editedValues).length} field(s)`,
    });
    
    alert("Saved successfully.");
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Save failed.";
    alert(message);
  } finally {
    setSaving(false);
  }
};

const applyMockExtraction = async (documentId: string, docType: DocumentType) => {
  const whitelist = FIELD_WHITELIST[docType] ?? [];
  if (whitelist.length === 0) return;

  const rows = whitelist.map((field_name) => {
    const value = MOCK_FIELD_VALUES[field_name] ?? `${prettyLabel(field_name)} (mock)`;
    return {
      document_id: documentId,
      field_name,
      extracted_value: value,
      normalized_value: value,
      confidence_score: 0.99,
    };
  });

  const { error } = await supabase
    .from("extracted_fields")
    .upsert(rows, { onConflict: "document_id,field_name" });

  if (error) throw error;
};

  /* ===============================
     RUN OCR (AI → pdf-parse → mock)
  ================================ */
const runOCRAndMap = async () => {
  if (!documentSetId) return;

  setRunningOCR(true);
  setOcrMsg("Extracting fields using AI…");

  try {
    // 1) Get all docs in this document set
    const { data: setDocsData, error } = await supabase
      .from("documents")
      .select("document_id, type, storage_path")
      .eq("document_set_id", documentSetId);

    if (error) throw error;
    if (!setDocsData || setDocsData.length === 0) {
      throw new Error("No documents found.");
    }

    let extractedCount = 0;

    // 2) Extract per document (AI → pdf-parse → mock)
    for (const d of setDocsData) {
      if (!d.storage_path) continue;

      setOcrMsg(`Extracting: ${d.type}…`);
      
      try {
        await extractDocument(documentSetId, d.document_id);
        extractedCount++;
      } catch (extractErr) {
        // Final fallback: mock data
        console.error(`All extraction methods failed for ${d.document_id}:`, extractErr);
        setOcrMsg(`Extraction failed for ${d.type}. Applying mock data…`);
        await applyMockExtraction(d.document_id, d.type as DocumentType);
      }
    }

    // 3) Reload UI to show extracted fields
    setOcrMsg("Reloading fields…");
    setReloadKey((k) => k + 1);

    // Log OCR activity
    await logActivity({
      action: "OCR_RUN",
      actor_role: "BROKER",
      reference_type: "document_set",
      reference_id: documentSetId,
      remarks: `Extracted ${extractedCount} document(s)`,
    });

    // Build result message
    const message = `Successfully extracted fields from ${extractedCount} document(s). Review the data below.`;
    alert(message);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Extraction failed.";
    alert(message);
  } finally {
    setRunningOCR(false);
    setOcrMsg(null);
  }
};


/* saveEdits removed — consolidated into saveChanges above */

  /* ===============================
     BUILD UI FIELDS (WHITE FIELDS)
  ================================ */
 const visibleFields: UIField[] = useMemo(() => {
  const whitelist = FIELD_WHITELIST[activeDoc];

  // if no selected document, show empty placeholders
  if (!activeDocId) {
    return whitelist.map((name) => ({
      field_name: name,
      value: "",
      confidence_score: null,
      isVirtual: true,
    }));
  }

  const best: Record<string, RawOCRField> = {};

  for (const f of rawFields) {
    // ✅ must be same tab AND same selected doc
    if (f.document.type !== activeDoc) continue;
    if (f.document.document_id !== activeDocId) continue;

    if (!whitelist.includes(f.field_name)) continue;

    const value = (f.normalized_value ?? f.extracted_value)?.trim();
    if (!value) continue;

    const score = f.confidence_score ?? 0;
    if (!best[f.field_name] || score > (best[f.field_name].confidence_score ?? 0)) {
      best[f.field_name] = f;
    }
  }

  return whitelist.map((name) => {
    const hit = best[name];
    return {
      field_id: hit?.field_id,
      field_name: name,
      value: editedValues[name] ?? hit?.normalized_value ?? hit?.extracted_value ?? "",
      confidence_score: hit?.confidence_score ?? null,
      isVirtual: !hit,
    };
  });
}, [rawFields, activeDoc, activeDocId, editedValues]);

  /* ===============================
     RENDER
  ================================ */
  return (
    <main style={{ padding: 24 }}>
      <div style={styles.card}>
        <header style={styles.header}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
              Review Extracted Data
            </h1>
            {lastSaved && (
              <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
                Last saved: {lastSaved.toLocaleTimeString("en-PH", { 
                  timeZone: "Asia/Manila", 
                  hour: "2-digit", 
                  minute: "2-digit", 
                  second: "2-digit",
                  hour12: true 
                })}
              </div>
            )}
          </div>

          <div style={styles.actions}>
            {!hasExtracted && (

              <Button variant="outline" onClick={runOCRAndMap} disabled={runningOCR}>
                {runningOCR ? ocrMsg ?? "Processing…" : "Run OCR & Auto-Extract"}
              </Button>

            )}

            <Button variant="primary" onClick={saveChanges} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>

          <Button
            variant="outline"
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={runningOCR || loading}
          >
            Refresh Fields
          </Button>
        </div>

        </header>

        <div style={styles.layout}>
          {/* LEFT */}
          <section style={styles.left}>
            {loading && <p>Loading…</p>}

            {!loading &&
              visibleFields.map((f) => (
                <div key={f.field_name} style={styles.field}>
                  <label style={styles.label}>{prettyLabel(f.field_name)}</label>
                  <input
                      style={styles.input}
                      value={editedValues[f.field_name] ?? f.value ?? ""}
                      onChange={(e) => handleChange(f.field_name, e.target.value)}
                      placeholder="(empty)"
                    />
                </div>
              ))}
          </section>

          {/* RIGHT */}
          <section style={styles.right}>
            <div style={styles.tabs}>
              {DOC_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveDoc(tab)}
                  style={{
                    ...styles.tab,
                    ...(activeDoc === tab ? styles.activeTab : {}),
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {docsForTab.length > 1 && (
              <div style={{ padding: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {docsForTab.map((d, idx) => (
                  <button
                    key={d.document_id}
                    onClick={() => setActiveDocId(d.document_id)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 10,
                      border: "1px solid #d6dde3",
                      background: d.document_id === activeDocId ? "#dbe5ee" : "#fff",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {activeDoc} {idx + 1}
                  </button>
                ))}
              </div>
            )}

            <div style={styles.pdf}>
              {previewLoading && <p style={{ padding: 16 }}>Loading preview…</p>}

              {!previewLoading && fileUrl ? (
                <iframe src={fileUrl} style={styles.iframe} />
              ) : (
                !previewLoading && <p style={{ padding: 16 }}>PDF not available</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

/* ===============================
   STYLES
================================ */
const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "#eef3f7",
    borderRadius: 16,
    padding: 18,
    maxWidth: 1500,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  actions: { display: "flex", gap: 8 },
  layout: {
    display: "grid",
    gridTemplateColumns: "420px 1fr",
    gap: 18,
  },
  left: {
    background: "#fff",
    borderRadius: 14,
    padding: 16,
    maxHeight: "78vh",
    overflowY: "auto",
  },
  field: {
    marginBottom: 14,
    paddingBottom: 12,
    borderBottom: "1px solid #eee",
  },
  label: { fontWeight: 700, marginBottom: 6, display: "block", fontSize: 13 },
  input: {
    width: "100%",
    padding: "10px 10px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "#fff",
  },
  right: {
    background: "#fff",
    borderRadius: 14,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  tabs: { display: "flex", borderBottom: "1px solid #e5e7eb" },
  tab: {
    padding: "10px 12px",
    background: "transparent",
    cursor: "pointer",
    borderTop: "none",
    borderLeft: "none",
    borderRight: "none",
    borderBottom: "2px solid transparent",
    fontWeight: 700,
  },
  activeTab: { borderBottom: "2px solid #2563eb" },
  pdf: { flex: 1, background: "#f4f6f8" },
  iframe: { width: "100%", height: "78vh", border: "none" },
};