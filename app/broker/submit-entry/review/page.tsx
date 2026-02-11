"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/app/lib/supabaseClient";
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

  const [activeDoc, setActiveDoc] = useState<DocumentType>("GD");
  const [activeDocId, setActiveDocId] = useState<string | null>(null);

  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [loading, setLoading] = useState(true);

  const [runningOCR, setRunningOCR] = useState(false);
  const [ocrMsg, setOcrMsg] = useState<string | null>(null);

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [savedValues, setSavedValues] = useState<Record<string, string>>({});
const [edited, setEdited] = useState<Record<string, string>>({});
const [saving, setSaving] = useState(false);
const [dirty, setDirty] = useState<Record<string, boolean>>({});
  

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

      setDocs(documents);

      const docMap: Record<string, DocumentRow> = Object.fromEntries(
        documents.map((d) => [d.document_id, d])
      );

      const { data: fields, error: fieldsErr } = await supabase
        .from("extracted_fields")
        .select(
          "field_id, document_id, field_name, extracted_value, normalized_value, confidence_score"
        )
        .neq("field_name", "raw_text")
        .in(
          "document_id",
          documents.map((d) => d.document_id)
        );

      if (fieldsErr) {
        console.error(fieldsErr);
        setRawFields([]);
      } else {
        setRawFields(
          (fields ?? []).map((f) => ({
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
     EDGE CALL (JWT + ANON KEY)
  ================================ */
   async function callEdge(fn: string, body: any) {
  // ✅ force refresh if needed
  await supabase.auth.refreshSession();

  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  if (!data.session) throw new Error("No active session");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const res = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey, // ✅ ANON key
      Authorization: `Bearer ${data.session.access_token}`, // ✅ broker JWT
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch {}

  if (!res.ok) throw new Error(json?.error || text || `Edge error ${res.status}`);
  return json;
}

function handleChange(fieldName: string, newValue: string) {
  setEditedValues((prev) => ({
    ...prev,
    [fieldName]: newValue,
  }));

}

const handleSave = async () => {
  try {
    for (const f of visibleFields) {
      const newValue = editedValues[f.field_name];
      if (newValue === undefined) continue; // not edited

      if (!f.field_id) {
        alert(`Cannot save "${f.field_name}" yet (no field_id).`);
        continue;
      }

      const { error } = await supabase
        .from("extracted_fields")
        .update({ normalized_value: newValue })
        .eq("field_id", f.field_id);

      if (error) throw error;
    }

    alert("Saved.");
    setReloadKey((k) => k + 1);
    setEditedValues({});
  } catch (e: any) {
    alert(e?.message ?? "Save failed");
  }
};

const saveChanges = async () => {
  if (!activeDocId) {
    alert("No active document selected.");
    return;
  }

  const entries = Object.entries(edited).filter(
    ([, v]) => (v ?? "").trim().length > 0
  );

  if (entries.length === 0) {
    alert("No changes to save.");
    return;
  }

  setSaving(true);
  try {
    const rows = entries.map(([field_name, value]) => ({
      document_id: activeDocId,
      field_name,
      extracted_value: null,
      normalized_value: value,
      confidence_score: null,
    }));

    const { error } = await supabase
      .from("extracted_fields")
      .upsert(rows, { onConflict: "document_id,field_name" });

    if (error) throw error;

    setEdited({});
    setReloadKey((k) => k + 1);
    alert("Saved.");
  } catch (e: any) {
    alert(e?.message ?? "Save failed.");
  } finally {
    setSaving(false);
  }
};

  /* ===============================
     RUN OCR + AUTO MAP
  ================================ */
const runOCRAndMap = async () => {
  if (!documentSetId) return;

  setRunningOCR(true);
  setOcrMsg("Running OCR (per document)…");

  try {
    // 1) get all docs in this document set
    const { data: setDocsData, error } = await supabase
      .from("documents")
      .select("document_id, type, storage_path")
      .eq("document_set_id", documentSetId);

    if (error) throw error;
    if (!docs || docs.length === 0) throw new Error("No documents found.");

    // 2) run OCR per doc (prevents WORKER_LIMIT)
    for (const d of docs) {
      if (!d.storage_path) continue;

      setOcrMsg(`Running OCR: ${d.type}…`);
      await callEdge("run-ocr", {
        document_set_id: documentSetId,
        document_id: d.document_id, // ✅ single doc mode
      });
    }

    // 3) call auto-map ONCE after all OCR is done
    setOcrMsg("Mapping fields…");
    await callEdge("auto-map-fields", { document_set_id: documentSetId });

    // 4) reload UI data (your existing reload function / setReloadKey)
    setOcrMsg("Reloading…");
    setReloadKey((k) => k + 1);

    alert("OCR + Auto-mapping complete.");
  } catch (e: any) {
    alert(e?.message ?? "Failed.");
  } finally {
    setRunningOCR(false);
    setOcrMsg(null);
  }
};


const saveEdits = async () => {
  if (!activeDocId) return alert("Select a document first.");

  const whitelist = FIELD_WHITELIST[activeDoc];

  const rows = whitelist.map((field_name) => ({
    document_id: activeDocId,
    field_name,
    extracted_value: draft[field_name] ?? "",
    normalized_value: draft[field_name] ?? "",
    confidence_score: null,
  }));

  // para di dumoble: delete then insert
  const { error: delErr } = await supabase
    .from("extracted_fields")
    .delete()
    .eq("document_id", activeDocId)
    .in("field_name", whitelist);

  if (delErr) return alert(delErr.message);

  const { error: insErr } = await supabase.from("extracted_fields").insert(rows);
  if (insErr) return alert(insErr.message);

  // reload UI from DB so it stays
  setReloadKey((k) => k + 1);
  alert("Saved.");
};

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
}, [rawFields, activeDoc, activeDocId]);

useEffect(() => {
  const init: Record<string, string> = {};
  for (const f of visibleFields) init[f.field_name] = f.value ?? "";
  setDraft(init);
  setDirty({});
}, [visibleFields]);

useEffect(() => {
  const next: Record<string, string> = {};
  for (const f of visibleFields) next[f.field_name] = f.value ?? "";
  setDraft(next);
}, [visibleFields]);

  /* ===============================
     RENDER
  ================================ */
  return (
    <main style={{ padding: 24 }}>
      <div style={styles.card}>
        <header style={styles.header}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
            Review Extracted Data
          </h1>

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
    border: "none",
    fontWeight: 700,
  },
  activeTab: { borderBottom: "2px solid #2563eb" },
  pdf: { flex: 1, background: "#f4f6f8" },
  iframe: { width: "100%", height: "78vh", border: "none" },
};