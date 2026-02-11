"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabaseClient";
import Button from "@/app/components/Button";

const supabase = createClient();

/* ===============================
   TYPES
================================ */
type DocumentType = "GD" | "INVOICE" | "PACKING_LIST" | "AWB";

type DocumentRow = {
  document_id: string;
  type: DocumentType;
  storage_path: string | null;
};

type RawField = {
  document_id: string;
  field_name: string;
  extracted_value: string | null;
  normalized_value: string | null;
};

type UIField = {
  field_name: string;
  value: string;
};

/* ===============================
   FIELD WHITELIST
================================ */
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

const DOC_TABS: DocumentType[] = ["GD", "INVOICE", "PACKING_LIST", "AWB"];

const prettyLabel = (k: string) =>
  k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/* ===============================
   STATUS CONFIG
================================ */
const STATUS_LABELS: Record<string, { label: string; bg: string; border: string; text: string }> = {
  pending: { label: "PENDING", bg: "#fef3c7", border: "#fde68a", text: "#92400e" },
  for_review: { label: "FOR REVIEW", bg: "#dbeafe", border: "#93c5fd", text: "#1e40af" },
  validated: { label: "VALIDATED", bg: "#dcfce7", border: "#86efac", text: "#14532d" },
  completed: { label: "COMPLETED", bg: "#dcfce7", border: "#86efac", text: "#14532d" },
  error: { label: "REJECTED", bg: "#fee2e2", border: "#fca5a5", text: "#7f1d1d" },
};

function normStatus(s: string | null | undefined) {
  return String(s ?? "")
    .trim()
    .toLowerCase();
}

/* ===============================
   COMPONENT
================================ */
function formatDateTime(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function ViewClient({ documentSetId }: { documentSetId: string | null }) {
  const router = useRouter();

  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [rawFields, setRawFields] = useState<RawField[]>([]);
  const [activeDoc, setActiveDoc] = useState<DocumentType>("GD");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("pending");
  const [officerRemarks, setOfficerRemarks] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  /* ── LOAD DATA ── */
  useEffect(() => {
    if (!documentSetId) return;

    const load = async () => {
      setLoading(true);

      // Document set status
      const { data: ds } = await supabase
        .from("document_sets")
        .select("status, created_at, submitted_at, validated_at")
        .eq("document_set_id", documentSetId)
        .single();

      if (ds) {
        setStatus(normStatus(ds.status));
        setOfficerRemarks(null); // officer_remarks column doesn't exist yet
        setCreatedAt(ds.created_at ?? ds.submitted_at ?? null);
        setUpdatedAt(ds.validated_at ?? null);
      }

      // Documents
      const { data: docs, error: docsErr } = await supabase
        .from("documents")
        .select("document_id, type, storage_path")
        .eq("document_set_id", documentSetId);

      if (docsErr || !docs) {
        setDocuments([]);
        setRawFields([]);
        setLoading(false);
        return;
      }

      setDocuments(docs as DocumentRow[]);

      // Extracted fields
      const { data: fields } = await supabase
        .from("extracted_fields")
        .select("document_id, field_name, extracted_value, normalized_value")
        .neq("field_name", "raw_text")
        .in(
          "document_id",
          docs.map((d: DocumentRow) => d.document_id)
        );

      setRawFields((fields ?? []) as RawField[]);

      // PDF for active tab
      const active = (docs as DocumentRow[]).find((d) => d.type === activeDoc);
      if (active?.storage_path) {
        const { data: signed } = await supabase.storage
          .from("documents")
          .createSignedUrl(active.storage_path, 3600);
        setPdfUrl(signed?.signedUrl ?? null);
      } else {
        setPdfUrl(null);
      }

      setLoading(false);
    };

    load();
  }, [documentSetId, activeDoc]);

  /* ── FIELDS ── */
  const visibleFields: UIField[] = useMemo(() => {
    const whitelist = FIELD_WHITELIST[activeDoc] ?? [];
    const map: Record<string, RawField> = {};

    for (const f of rawFields) {
      if (!whitelist.includes(f.field_name)) continue;
      map[f.field_name] = f;
    }

    return whitelist.map((name) => ({
      field_name: name,
      value: map[name]?.normalized_value ?? map[name]?.extracted_value ?? "—",
    }));
  }, [rawFields, activeDoc]);

  /* ── STATUS BADGE ── */
  const statusInfo = STATUS_LABELS[status] ?? STATUS_LABELS.pending;

  /* ── RENDER ── */
  if (!documentSetId) {
    return (
      <main style={{ padding: 32 }}>
        <p>No document set ID provided.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 32 }}>
      <div style={styles.shell}>
        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Submission Details</h1>
            <p style={{ marginTop: 6, fontSize: 13, color: "#555" }}>
              Read-only view of your submitted formal entry.
            </p>
            {createdAt && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
                <strong>Submitted:</strong> {formatDateTime(createdAt)}
                {updatedAt && updatedAt !== createdAt && (
                  <span style={{ marginLeft: 12 }}>
                    <strong>Last Updated:</strong> {formatDateTime(updatedAt)}
                  </span>
                )}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {/* STATUS BADGE */}
            <div
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                background: statusInfo.bg,
                border: `1px solid ${statusInfo.border}`,
                fontWeight: 800,
                fontSize: 12,
                color: statusInfo.text,
              }}
            >
              {statusInfo.label}
            </div>

            <Button variant="outline" onClick={() => router.push("/broker/submission-status")}>
              Back
            </Button>
          </div>
        </div>

        {/* OFFICER REMARKS */}
        {officerRemarks && (
          <div
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 10,
              background: "#fff7ed",
              border: "1px solid #fdba74",
              fontSize: 13,
              color: "#9a3412",
            }}
          >
            <strong>Officer Remarks:</strong> {officerRemarks}
          </div>
        )}

        {/* GRID */}
        <div style={styles.grid}>
          {/* LEFT — FIELDS */}
          <section style={styles.leftCard}>
            <div style={styles.sectionTitle}>Extracted Fields</div>

            {loading ? (
              <div style={{ fontSize: 13, color: "#555" }}>Loading...</div>
            ) : (
              visibleFields.map((f) => (
                <div key={f.field_name} style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 700, display: "block", fontSize: 13, color: "#111827" }}>
                    {prettyLabel(f.field_name)}
                  </label>
                  <div
                    style={{
                      background: "#f4f6f8",
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid #e5e7eb",
                      fontSize: 13,
                      marginTop: 6,
                      color: "#111827",
                      wordBreak: "break-word",
                    }}
                  >
                    {f.value}
                  </div>
                </div>
              ))
            )}
          </section>

          {/* RIGHT — PDF */}
          <section style={styles.rightCard}>
            <div style={styles.tabBar}>
              {DOC_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveDoc(tab)}
                  style={{
                    padding: "10px 14px",
                    fontWeight: activeDoc === tab ? 700 : 500,
                    borderTop: "none",
                    borderLeft: "none",
                    borderRight: "none",
                    borderBottom: activeDoc === tab ? "2px solid #2563eb" : "2px solid transparent",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                style={{ width: "100%", height: "78vh", border: "none", background: "#fff" }}
              />
            ) : (
              <div style={{ padding: 16, fontSize: 13, color: "#555" }}>
                {loading ? "Loading preview..." : "PDF not available."}
              </div>
            )}
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
  shell: {
    background: "#eef3f7",
    borderRadius: 16,
    padding: 24,
    maxWidth: 1500,
    margin: "0 auto",
    border: "1px solid #e6edf3",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "380px 1fr",
    gap: 24,
    marginTop: 16,
  },
  leftCard: {
    background: "#fff",
    borderRadius: 14,
    padding: 18,
    maxHeight: "78vh",
    overflowY: "auto",
    border: "1px solid #e5e7eb",
  },
  rightCard: {
    background: "#fff",
    borderRadius: 14,
    display: "flex",
    flexDirection: "column",
    border: "1px solid #e5e7eb",
    overflow: "hidden",
  },
  tabBar: {
    display: "flex",
    borderBottom: "1px solid #e5e7eb",
    background: "#f7f9fb",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 0.4,
    color: "#1f2937",
    marginTop: 0,
    marginBottom: 10,
    textTransform: "uppercase",
  },
};
