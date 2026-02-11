"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { createClient } from "@/app/lib/supabaseClient";

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
   VALIDATION TYPES
================================ */
type ValidationStatus = "pass" | "fail";
type ValidationSeverity = "critical" | "warning" | "info" | null;

type ValidationRuleType = "REQUIRED" | "CLASSIFICATION" | "VALUATION" | "LOGISTICS";

type ValidationRow = {
  result_id: string;
  document_set_id: string;
  rule_id: string | null;
  status: ValidationStatus;
  severity: ValidationSeverity;
  remarks: string | null;
  evaluated_at: string;

  // joined
  validation_rules?: {
    rule_type: ValidationRuleType | null;
    expected_behavior: string | null;
  }[] | null;
};

type ValidationItem = {
  id: string;
  rule_type: ValidationRuleType;
  status: ValidationStatus;
  severity: ValidationSeverity;
  text: string;
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
   PAGE
================================ */
export default function OfficerViewEntriesPage() {
  const params = useSearchParams();
  const router = useRouter();
  const documentSetId = params.get("document_set_id");

  useEffect(() => {
  (async () => {
    const { data } = await supabase.auth.getSession();

    console.log("TEST 1 — SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log(
      "TEST 1 — TOKEN_FIRST_30:",
      data.session?.access_token?.slice(0, 30)
    );
    console.log("TEST 1 — USER_ID:", data.session?.user?.id);
  })();
}, []);

useEffect(() => {
  (async () => {
    const { data } = await supabase.auth.getSession();
    const jwt = data.session?.access_token;

    if (!jwt) {
      console.log("TEST 2 — NO JWT FOUND");
      return;
    }

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
      }
    );

    console.log("TEST 2 — AUTH /user STATUS:", res.status);
    console.log("TEST 2 — AUTH /user BODY:", await res.json());
  })();
}, []);

  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [rawFields, setRawFields] = useState<RawField[]>([]);
  const [activeDoc, setActiveDoc] = useState<DocumentType>("GD");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  const [validationLoading, setValidationLoading] = useState(true);
  const [validationRows, setValidationRows] = useState<ValidationRow[]>([]);

  const [remarks, setRemarks] = useState("");
  const [processing, setProcessing] = useState(false);

  /* ===============================
     CONFIRMATION MODAL STATE
  =============================== */
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<
    "SEND_BACK" | "REJECT" | "PROCEED" | null
  >(null);

  /* ===============================
     LOAD DATA (DOCS, FIELDS, VALIDATIONS, PDF)
  =============================== */
  useEffect(() => {
    if (!documentSetId) return;

    const load = async () => {
      setLoading(true);
      setValidationLoading(true);

      // 1) Documents
      const { data: docs, error: docsErr } = await supabase
        .from("documents")
        .select("document_id, type, storage_path")
        .eq("document_set_id", documentSetId);

      if (docsErr || !docs) {
        setDocuments([]);
        setRawFields([]);
        setPdfUrl(null);
        setLoading(false);
        setValidationRows([]);
        setValidationLoading(false);
        return;
      }

      setDocuments(docs as DocumentRow[]);

      // 2) Extracted fields (skip raw_text)
      const { data: fields } = await supabase
        .from("extracted_fields")
        .select("document_id, field_name, extracted_value, normalized_value")
        .neq("field_name", "raw_text")
        .in(
          "document_id",
          docs.map((d) => d.document_id)
        );

      setRawFields((fields ?? []) as RawField[]);

      // 3) Validation rows + join rule info
      // NOTE: requires FK validation_results.rule_id -> validation_rules.rule_id
      const { data: vrows } = await supabase
        .from("validation_results")
        .select(
          `
          result_id,
          document_set_id,
          rule_id,
          status,
          severity,
          remarks,
          evaluated_at,
          validation_rules:rule_id (
            rule_type,
            expected_behavior
          )
        `
        )
        .eq("document_set_id", documentSetId)
        .order("evaluated_at", { ascending: false });

      setValidationRows((vrows ?? []) as ValidationRow[]);
      setValidationLoading(false);

      // 4) Signed PDF for active tab
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

  /* ===============================
     LEFT PANEL FIELDS (READ-ONLY)
  =============================== */
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

  /* ===============================
     VALIDATION UI MODEL
  =============================== */
  const validationItems: ValidationItem[] = useMemo(() => {
    return validationRows
      .map((r) => {
        const vr = r.validation_rules?.[0]; // first joined rule row
        const ruleType = ((vr?.rule_type ?? "LOGISTICS") as ValidationRuleType);
        const expected = vr?.expected_behavior?.trim();

        const msg = r.remarks?.trim();

        return {
          id: r.result_id,
          rule_type: ruleType,
          status: r.status,
          severity: r.severity,
          text: expected || msg || "Validation result recorded.",
        };
      })
      .filter(Boolean);
  }, [validationRows]);

  const validationsByType = useMemo(() => {
    const groups: Record<ValidationRuleType, ValidationItem[]> = {
      REQUIRED: [],
      CLASSIFICATION: [],
      VALUATION: [],
      LOGISTICS: [],
    };

    for (const v of validationItems) {
      groups[v.rule_type]?.push(v);
    }
    return groups;
  }, [validationItems]);

  const hasCriticalFail = useMemo(() => {
    // block PROCEED if any CRITICAL fail
    return validationItems.some(
      (v) => v.status === "fail" && v.severity === "critical"
    );
  }, [validationItems]);

  const hasAnyFail = useMemo(() => {
    return validationItems.some((v) => v.status === "fail");
  }, [validationItems]);

  /* ===============================
     OPEN CONFIRM MODAL
  =============================== */
  const openConfirm = (action: "SEND_BACK" | "REJECT" | "PROCEED") => {
    if (processing) return;
    setSelectedAction(action);
    setShowConfirmModal(true);
  };

  /* ===============================
     EDGE FUNCTION CALL
     (we are NOT changing your edge function here)
  =============================== */
  const runOfficerAction = async (action: "SEND_BACK" | "REJECT" | "PROCEED") => {
    if (processing) return;
    setProcessing(true);

    try {
      if (!documentSetId) {
        alert("Missing document_set_id in URL.");
        return;
      }

      if (action !== "PROCEED" && !remarks.trim()) {
        alert("Remarks required for Send Back / Reject.");
        return;
      }

      const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr || !sessionData.session) {
        alert("Session expired. Please re-login.");
        return;
      }

      console.log("SESSION:", sessionData?.session);
      console.log("USER_ID:", sessionData.session.user?.id);
      console.log("EMAIL:", sessionData.session.user?.email);
      console.log("ACCESS TOKEN:", sessionData.session.access_token);

      const accessToken = sessionData.session.access_token;

      const res = await fetch(
        "https://vziasnnzmmuhcuthbxcp.supabase.co/functions/v1/officer-action",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            document_set_id: documentSetId,
            action,
            remarks: action === "PROCEED" ? null : remarks.trim(),
          }),
        }
      );

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(result?.error || `Officer action failed (HTTP ${res.status}).`);
        return;
      }

      // success
      setShowConfirmModal(false);
      setSelectedAction(null);
      setRemarks("");

      router.push("/officer/submitted-entries");
    } catch (e) {
      console.error(e);
      alert("Network / server error.");
    } finally {
      setProcessing(false);
    }
  };

  /* ===============================
     STYLES (GOV / ENTERPRISE FEEL)
  =============================== */
  const pageWrap: React.CSSProperties = {
    padding: 32,
  };

  const shell: React.CSSProperties = {
    background: "#eef3f7",
    borderRadius: 16,
    padding: 24,
    maxWidth: 1500,
    margin: "0 auto",
    border: "1px solid #e6edf3",
  };

  const grid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "380px 1fr",
    gap: 24,
    marginTop: 16,
  };

  const leftCard: React.CSSProperties = {
    background: "#fff",
    borderRadius: 14,
    padding: 18,
    maxHeight: "78vh",
    overflowY: "auto",
    border: "1px solid #e5e7eb",
  };

  const rightCard: React.CSSProperties = {
    background: "#fff",
    borderRadius: 14,
    display: "flex",
    flexDirection: "column",
    border: "1px solid #e5e7eb",
    overflow: "hidden",
  };

  const tabBar: React.CSSProperties = {
    display: "flex",
    borderBottom: "1px solid #e5e7eb",
    background: "#f7f9fb",
  };

    const tabBtn = (active: boolean): React.CSSProperties => ({
      padding: "10px 14px",
      fontWeight: active ? 700 : 500,
      borderTop: "none",
      borderLeft: "none",
      borderRight: "none",
      borderBottom: active ? "2px solid #2563eb" : "2px solid transparent",
      background: "transparent",
      cursor: "pointer",
    });

  const sectionTitle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 0.4,
    color: "#1f2937",
    marginTop: 0,
    marginBottom: 10,
    textTransform: "uppercase",
  };

  const badgeStyle = (status: ValidationStatus, severity: ValidationSeverity) => {
    const isFail = status === "fail";
    const isCritical = severity === "critical";

    const bg = isFail ? (isCritical ? "#fee2e2" : "#fef3c7") : "#dcfce7";
    const border = isFail ? (isCritical ? "#dc2626" : "#d97706") : "#16a34a";
    const text = isFail ? (isCritical ? "#7f1d1d" : "#92400e") : "#14532d";

    return { bg, border, text };
  };

  /* ===============================
     RENDER
  =============================== */
  return (
    <main style={pageWrap}>
      <div style={shell}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 style={{ margin: 0 }}>Formal Entry Review (Officer)</h1>
            <p style={{ marginTop: 6, fontSize: 13, color: "#555" }}>
              Read-only review of system-extracted data vs submitted documents.
            </p>
          </div>

          {/* ACTIONS (top-right) */}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <Button
              variant="outline"
              disabled={loading || processing}
              onClick={() => router.push("/officer/submitted-entries")}
            >
              Back
            </Button>

            <Button
              variant="outline"
              disabled={loading || processing}
              onClick={() => openConfirm("SEND_BACK")}
            >
              Send Back
            </Button>

            <Button
              variant="outline"
              disabled={loading || processing}
              onClick={() => openConfirm("REJECT")}
            >
              Reject
            </Button>

                    <button
            onClick={() => {
              setShowConfirmModal(false);
              setSelectedAction(null);

              router.push(
                `/officer/compute-entries?document_set_id=${documentSetId}`
              );
            }}
            disabled={processing || hasCriticalFail}
            style={{
              padding: "9px 12px",
              borderRadius: 10,
              background: "#2563eb",
              color: "#fff",
              fontWeight: 800,
            }}
          >
            Confirm
          </button>

          </div>
        </div>

        <div style={grid}>
          {/* LEFT */}
          <section style={leftCard}>
            {/* VALIDATION ADVICE */}
            <div style={{ marginBottom: 16 }}>
              <div style={sectionTitle}>Validation Advice</div>

              {validationLoading ? (
                <div style={{ fontSize: 13, color: "#555" }}>Loading validation checks…</div>
              ) : validationItems.length === 0 ? (
                <div style={{ fontSize: 13, color: "#555" }}>
                  No validation results found for this document set.
                </div>
              ) : (
                <>
                  {Object.entries(validationsByType).map(([type, items]) => {
                    if (!items.length) return null;

                    return (
                      <div key={type} style={{ marginBottom: 14 }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            color: "#374151",
                            marginBottom: 8,
                            letterSpacing: 0.3,
                          }}
                        >
                          {type}
                        </div>

                        {items.map((v) => {
                          const s = badgeStyle(v.status, v.severity);
                          return (
                            <div
                              key={v.id}
                              style={{
                                padding: 10,
                                borderRadius: 10,
                                marginBottom: 8,
                                background: s.bg,
                                border: `1px solid ${s.border}`,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  gap: 10,
                                }}
                              >
                                <div style={{ fontWeight: 800, color: s.text, fontSize: 12 }}>
                                  {v.status.toUpperCase()}
                                  {v.severity ? ` • ${v.severity.toUpperCase()}` : ""}
                                </div>
                              </div>
                              <div style={{ marginTop: 6, fontSize: 13, color: "#111827" }}>
                                {v.text}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}

                  {/* PROCEED NOTE */}
                  <div
                    style={{
                      marginTop: 8,
                      padding: 10,
                      borderRadius: 10,
                      background: hasCriticalFail ? "#fff1f2" : hasAnyFail ? "#fffbeb" : "#f0fdf4",
                      border: `1px solid ${
                        hasCriticalFail ? "#fecdd3" : hasAnyFail ? "#fde68a" : "#bbf7d0"
                      }`,
                      fontSize: 13,
                      color: "#374151",
                    }}
                  >
                    <strong>Proceed rule:</strong>{" "}
                    {hasCriticalFail
                      ? "Blocked — critical validation failure detected."
                      : hasAnyFail
                      ? "Allowed, but review is recommended."
                      : "Allowed — all checks passed."}
                  </div>
                </>
              )}
            </div>

            {/* REMARKS (for send back / reject) */}
            <div style={{ marginBottom: 16 }}>
              <div style={sectionTitle}>Officer Remarks</div>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Required for Send Back / Reject."
                style={{
                  width: "100%",
                  minHeight: 92,
                  resize: "vertical",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  outline: "none",
                  fontSize: 13,
                  background: "#fff",
                }}
              />
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
                Proceed does not require remarks.
              </div>
            </div>

            {/* EXTRACTED FIELDS */}
            <div style={sectionTitle}>Extracted Fields</div>
            {loading ? (
              <div style={{ fontSize: 13, color: "#555" }}>Loading…</div>
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

          {/* RIGHT */}
          <section style={rightCard}>
            {/* TABS */}
            <div style={tabBar}>
              {DOC_TABS.map((tab) => (
                <button key={tab} onClick={() => setActiveDoc(tab)} style={tabBtn(activeDoc === tab)}>
                  {tab}
                </button>
              ))}
            </div>

            {/* PDF */}
            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                style={{
                  width: "100%",
                  height: "80vh",
                  border: "none",
                  background: "#fff",
                }}
              />
            ) : (
              <div style={{ padding: 16, fontSize: 13, color: "#555" }}>PDF not available.</div>
            )}
          </section>
        </div>
      </div>

      {/* ===============================
          CONFIRMATION MODAL (SINGLE)
      =============================== */}
      {showConfirmModal && selectedAction && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => {
            setShowConfirmModal(false);
            setSelectedAction(null);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              background: "#ffffff",
              borderRadius: 12,
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
              overflow: "hidden",
              border: "1px solid #e5e7eb",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER */}
            <div
              style={{
                padding: "16px 18px",
                borderBottom: "1px solid #e5e7eb",
                background: "#f7f9fb",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>
                Confirm Officer Action
              </div>
              <div style={{ fontSize: 13, color: "#555", marginTop: 6 }}>
                {selectedAction === "SEND_BACK"
                  ? "This will return the entry to the broker for correction."
                  : selectedAction === "REJECT"
                  ? "This will reject the entry."
                  : "This will proceed to the next phase (tax computation)."}
              </div>
            </div>

            {/* BODY */}
            <div style={{ padding: 18 }}>
              <div style={{ fontSize: 14, color: "#111827", lineHeight: 1.5 }}>
                Are you sure you want to{" "}
                <strong>
                  {selectedAction === "SEND_BACK"
                    ? "send this entry back"
                    : selectedAction === "REJECT"
                    ? "reject this entry"
                    : "proceed"}
                </strong>
                ?
              </div>

              {selectedAction === "PROCEED" && hasCriticalFail && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 10,
                    borderRadius: 10,
                    background: "#fff1f2",
                    border: "1px solid #fecdd3",
                    fontSize: 13,
                    color: "#7f1d1d",
                  }}
                >
                  Proceed is blocked because a <strong>critical</strong> validation failed.
                </div>
              )}

              {selectedAction !== "PROCEED" && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 10,
                    borderRadius: 10,
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    fontSize: 13,
                    color: "#374151",
                  }}
                >
                  <strong>Remarks will be submitted</strong> with this action.
                </div>
              )}
            </div>

            {/* FOOTER */}
            <div
              style={{
                padding: 14,
                borderTop: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                background: "#fff",
              }}
            >
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setSelectedAction(null);
                }}
                style={{
                  padding: "9px 12px",
                  borderRadius: 10,
                  background: "#e5e7eb",
                  border: "1px solid #d1d5db",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
                disabled={processing}
              >
                Cancel
              </button>

              <button
                onClick={() => runOfficerAction(selectedAction)}
                style={{
                  padding: "9px 12px",
                  borderRadius: 10,
                  background:
                    selectedAction === "REJECT"
                      ? "#dc2626"
                      : selectedAction === "SEND_BACK"
                      ? "#f97316"
                      : "#2563eb",
                  border: "1px solid rgba(0,0,0,0.05)",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: processing ? "not-allowed" : "pointer",
                  opacity:
                    processing || (selectedAction === "PROCEED" && hasCriticalFail) ? 0.6 : 1,
                }}
                disabled={processing || (selectedAction === "PROCEED" && hasCriticalFail)}
              >
                {processing ? "Processing…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
} 