"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { createClient } from "@/app/lib/supabaseClient";
import { logActivity } from "@/app/lib/activityLogger";

const supabase = createClient();

/* ===============================
   TYPES
================================ */
type PreviewRow = {
  line_no?: number | null;
  description?: string | null;
  hs_code?: string | null;
  currency?: string | null;

  declared_value?: number | null;
  exchange_rate?: number | null;
  declared_value_php?: number | null;

  duty_rate?: number | null;
  duty_amount?: number | null;

  vat_rate?: number | null;
  vat_amount?: number | null;

  total_tax?: number | null;

  [key: string]: any;
};

type PreviewSummary = Record<string, any> | null;

/* ===============================
   HELPERS
================================ */
const asISODate = (d: Date) => d.toISOString().slice(0, 10);

const fmtNum = (v: any) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

/* ===============================
   PAGE
================================ */
export default function OfficerComputeEntriesPage() {
  const params = useSearchParams();
  const router = useRouter();
  const documentSetId = params.get("document_set_id");

  // FX (always visible)
  const [rateLoading, setRateLoading] = useState(true);
  const [rateError, setRateError] = useState<string | null>(null);
  const [rateDate, setRateDate] = useState<string | null>(null);

  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [quoteCurrency, setQuoteCurrency] = useState("PHP");
  const [exchangeRate, setExchangeRate] = useState<number | "">("");

  const [officerRateMode, setOfficerRateMode] = useState<"AUTO" | "MANUAL">("AUTO");

  // Preview
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [previewSummary, setPreviewSummary] = useState<PreviewSummary>(null);

  // Modal
  const [showConfirm, setShowConfirm] = useState(false);
  const [processing, setProcessing] = useState(false);

  /* ===============================
     API CALL (Local Next.js routes)
  =============================== */
  async function callApi(endpoint: string, body?: Record<string, unknown>) {
    const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
    if (sessErr) throw new Error(sessErr.message);
    if (!sessionData.session) throw new Error("No active session");

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify(body ?? {}),
    });

    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      throw new Error(`Non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`);
    }

    if (!res.ok) {
      const error = (json?.error as string) || (json?.reason as string) || `API call failed (HTTP ${res.status})`;
      throw new Error(error);
    }

    return json;
  }

  /* ===============================
     LOADERS
  =============================== */
  useEffect(() => {
    if (!documentSetId) return;
    loadRate();
    loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentSetId]);

  /* ===============================
     FX LOADER
     (shows even when preview is empty)
  =============================== */
  const loadRate = async () => {
    setRateLoading(true);
    setRateError(null);

    try {
      const today = asISODate(new Date());

      // Get forex rate from local API
      const r = await callApi("/api/forex-rate", {
        base_currency: "USD",
        quote_currency: "PHP",
        rate_date: today,
      });

      const rate = Number(r?.rate);
      if (!Number.isFinite(rate)) throw new Error("Rate not available");

      setExchangeRate(rate);
      setRateDate((r?.rate_date as string) ?? today);
      setBaseCurrency((r?.base_currency as string) ?? "USD");
      setQuoteCurrency((r?.quote_currency as string) ?? "PHP");
      setOfficerRateMode("AUTO");
    } catch (e: any) {
      setRateError(e?.message ?? "Failed to load exchange rate.");
    } finally {
      setRateLoading(false);
    }
  };

  const refreshRate = async () => {
    setOfficerRateMode("AUTO");
    await loadRate();
  };

  /* ===============================
     PREVIEW LOADER
     (allowed to fail/empty; FX still shows)
  =============================== */
  const loadPreview = async () => {
    setLoadingPreview(true);
    setPreviewError(null);

    try {
      const existing = await callApi("/api/tax-preview", {
        document_set_id: documentSetId,
      });

      setPreviewRows((existing?.rows as PreviewRow[]) ?? []);
      setPreviewSummary((existing?.summary as PreviewSummary) ?? null);
    } catch (e: any) {
      // Don’t block page
      setPreviewRows([]);
      setPreviewSummary(null);
      setPreviewError(e?.message ?? null);
    } finally {
      setLoadingPreview(false);
    }
  };

  /* ===============================
     COMPUTE PREVIEW
  =============================== */
  const computePreview = async () => {
    if (!documentSetId) return;

    if (exchangeRate === "" || !Number.isFinite(Number(exchangeRate))) {
      alert("Please enter a valid exchange rate.");
      return;
    }

    setProcessing(true);
    try {
      const result = await callApi("/api/tax-preview", {
        document_set_id: documentSetId,
        base_currency: baseCurrency || "USD",
        quote_currency: quoteCurrency || "PHP",
        exchange_rate: Number(exchangeRate),
        rate_date: rateDate ?? asISODate(new Date()),
        rate_mode: officerRateMode, // AUTO / MANUAL
      });

      setPreviewRows((result?.rows as PreviewRow[]) ?? []);
      setPreviewSummary((result?.summary as PreviewSummary) ?? null);
      setShowConfirm(false);

      // Log computation
      await logActivity({
        action: "OFFICER_COMPUTE_TAX",
        actor_role: "CUSTOMS_OFFICER",
        reference_type: "document_set",
        reference_id: documentSetId,
        remarks: `Computed tax preview (rate: ${exchangeRate})`,
      });
    } catch (e: any) {
      alert(e?.message ?? "Failed to compute preview.");
    } finally {
      setProcessing(false);
    }
  };

  /* ===============================
   CONFIRM FINAL COMPUTATION
=============================== */
const confirmComputation = async () => {
  if (!documentSetId) return;

  if (exchangeRate === "" || !Number.isFinite(Number(exchangeRate))) {
    alert("Please enter a valid exchange rate.");
    return;
  }

  setProcessing(true);
  try {
    await callApi("/api/tax-preview", {
      document_set_id: documentSetId,
      exchange_rate: Number(exchangeRate),
      base_currency: baseCurrency,
      quote_currency: quoteCurrency,
      confirm: true,
    });

    // Log confirmation
    await logActivity({
      action: "OFFICER_COMPUTE_TAX",
      actor_role: "CUSTOMS_OFFICER",
      reference_type: "document_set",
      reference_id: documentSetId,
      remarks: `Confirmed final computation (rate: ${exchangeRate})`,
    });

    alert("Tax computation confirmed.");
    router.push(`/officer/view-entries?document_set_id=${documentSetId}`);
  } catch (e: any) {
    alert(e?.message ?? "Failed to confirm computation.");
  } finally {
    setProcessing(false);
  }
};

  /* ===============================
     UI DERIVED
  =============================== */
  const columns = useMemo(() => {
    const base = [
      { key: "line_no", label: "Line" },
      { key: "description", label: "Description" },
      { key: "hs_code", label: "HS Code" },
      { key: "declared_value_php", label: "Dutiable (PHP)" },
      { key: "duty_amount", label: "Duty" },
      { key: "vat_amount", label: "VAT" },
      { key: "total_tax", label: "Total" },
    ];

    if (!previewRows.length) return base;

    const exists = (k: string) => previewRows.some((r) => r?.[k] !== undefined && r?.[k] !== null);
    return base.filter((c) => exists(c.key) || c.key === "description" || c.key === "line_no");
  }, [previewRows]);

  const totalTax = useMemo(() => {
    if (!previewRows.length) return null;
    return previewRows.reduce((acc, r) => acc + (Number(r.total_tax) || 0), 0);
  }, [previewRows]);

  /* ===============================
     STYLES (gov/enterprise)
  =============================== */
  const styles: Record<string, React.CSSProperties> = {
    page: { padding: 32 },
    card: {
      background: "#eef3f7",
      borderRadius: 16,
      padding: 24,
      maxWidth: 1500,
      margin: "0 auto",
      border: "1px solid #e6edf3",
    },
    topRow: { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" },
    title: { margin: 0 },
    subtitle: { marginTop: 6, fontSize: 13, color: "#555" },

    fxCard: {
      background: "#ffffff",
      borderRadius: 12,
      border: "1px solid #d6dde3",
      padding: 16,
      marginTop: 14,
    },
    fxHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    fxTitle: {
      fontWeight: 800,
      fontSize: 13,
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: "#1f2937",
    },
    fxRefresh: {
      padding: "9px 12px",
      borderRadius: 10,
      border: "1px solid #d6dde3",
      background: "#f7f9fb",
      fontWeight: 700,
      cursor: "pointer",
    },
    fxRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: 12 },
    fxCol: { display: "flex", flexDirection: "column" },
    fxLabel: { fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#111827" },
    fxInputReadonly: {
      padding: 10,
      borderRadius: 10,
      border: "1px solid #d6dde3",
      background: "#f7f9fb",
      fontSize: 13,
    },
    fxInput: {
      padding: 10,
      borderRadius: 10,
      border: "1px solid #d6dde3",
      background: "#ffffff",
      fontSize: 13,
      outline: "none",
    },
    fxMeta: { marginTop: 10, fontSize: 12, color: "#6b7280" },
    fxError: { marginTop: 8, fontSize: 12, color: "#b00020" },

    previewCard: {
      background: "#ffffff",
      borderRadius: 12,
      border: "1px solid #d6dde3",
      marginTop: 14,
      overflow: "hidden",
    },
    table: { width: "100%", borderCollapse: "collapse" },
    th: {
      textAlign: "left",
      fontSize: 12,
      padding: "12px 14px",
      borderBottom: "1px solid #d6dde3",
      background: "#f7f9fb",
      fontWeight: 800,
      color: "#111827",
    },
    td: {
      fontSize: 13,
      padding: "12px 14px",
      borderBottom: "1px solid #eef2f6",
      verticalAlign: "top",
    },
    empty: { padding: 16, textAlign: "center", fontStyle: "italic", color: "#6b7280" },
    err: { padding: 16, color: "#b00020", fontSize: 13 },

    totalsWrap: { borderTop: "1px solid #d6dde3", background: "#f7f9fb" },
    totalsRow: { display: "grid", gridTemplateColumns: "1fr 200px" },
    totalLabel: { padding: "18px 16px", fontSize: 15, fontWeight: 800 },
    totalValue: { padding: "18px 16px", textAlign: "right", fontSize: 15, fontWeight: 800 },

    actions: { display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 },

    overlay: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: 16,
    },
    modal: {
      width: "100%",
      maxWidth: 520,
      background: "#ffffff",
      borderRadius: 12,
      boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
      overflow: "hidden",
      border: "1px solid #e5e7eb",
    },
    modalHeader: { padding: "16px 18px", borderBottom: "1px solid #e5e7eb", background: "#f7f9fb" },
    modalTitle: { fontSize: 16, fontWeight: 800, color: "#111827" },
    modalSub: { fontSize: 13, color: "#555", marginTop: 6 },
    modalBody: { padding: 18 },
    modalFooter: {
      padding: 14,
      borderTop: "1px solid #e5e7eb",
      display: "flex",
      justifyContent: "flex-end",
      gap: 10,
      background: "#fff",
    },
    btnSecondary: {
      padding: "9px 12px",
      borderRadius: 10,
      background: "#e5e7eb",
      border: "1px solid #d1d5db",
      fontWeight: 700,
      cursor: "pointer",
    },
    btnPrimary: {
      padding: "9px 12px",
      borderRadius: 10,
      background: "#2563eb",
      border: "1px solid rgba(0,0,0,0.05)",
      color: "#fff",
      fontWeight: 800,
      cursor: "pointer",
    },
  };

  /* ===============================
     RENDER
  =============================== */
  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <div style={styles.topRow}>
          <div>
            <h1 style={styles.title}>Tax Computation Preview (Officer)</h1>
            <p style={styles.subtitle}>
              Officer-editable preview. Exchange rate is shown even when preview is empty.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="outline" onClick={() => router.back()} disabled={processing}>
              Back
            </Button>

            <Button disabled={processing || rateLoading} onClick={() => setShowConfirm(true)}>
              Compute / Refresh Preview
            </Button>
          </div>
        </div>

        {/* FX */}
        <section style={styles.fxCard}>
          <div style={styles.fxHeader}>
            <div style={styles.fxTitle}>Currency & Exchange Rate</div>
            <button type="button" onClick={refreshRate} disabled={rateLoading} style={styles.fxRefresh}>
              {rateLoading ? "Checking…" : "Refresh Rate"}
            </button>
          </div>

          <div style={styles.fxRow}>
            <div style={styles.fxCol}>
              <label style={styles.fxLabel}>Base Currency</label>
              <input value={baseCurrency} readOnly style={styles.fxInputReadonly} />
            </div>

            <div style={styles.fxCol}>
              <label style={styles.fxLabel}>Quote Currency</label>
              <input value={quoteCurrency} readOnly style={styles.fxInputReadonly} />
            </div>

            <div style={styles.fxCol}>
              <label style={styles.fxLabel}>Exchange Rate (editable)</label>
              <input
                type="number"
                step="0.0001"
                value={exchangeRate}
                onChange={(e) => {
                  setOfficerRateMode("MANUAL");
                  setExchangeRate(e.target.value === "" ? "" : Number(e.target.value));
                }}
                style={styles.fxInput}
              />
            </div>
          </div>

          <div style={styles.fxMeta}>
            Default rate loads even if preview is empty{rateDate ? ` (${rateDate})` : ""}. Mode:{" "}
            <strong>{officerRateMode}</strong>
          </div>

          {rateError && <div style={styles.fxError}>{rateError}</div>}
        </section>

        {/* PREVIEW */}
        <section style={styles.previewCard}>
          {previewError && <div style={styles.err}>{previewError}</div>}

          {loadingPreview ? (
            <div style={styles.empty}>Loading preview…</div>
          ) : !previewRows.length ? (
            <div style={styles.empty}>No preview available.</div>
          ) : (
            <>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {columns.map((c) => (
                      <th key={c.key} style={styles.th}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, idx) => (
                    <tr key={idx}>
                      {columns.map((c) => (
                        <td key={c.key} style={styles.td}>
                          {c.key === "description" ? (r[c.key] ?? "—") : fmtNum(r[c.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={styles.totalsWrap}>
                <div style={styles.totalsRow}>
                  <div style={styles.totalLabel}>Total Estimated Tax</div>
                  <div style={styles.totalValue}>{totalTax == null ? "—" : fmtNum(totalTax)}</div>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Actions */}
        <div style={styles.actions}>
          <Button
            variant="outline"
            disabled={processing}
            onClick={() => router.push(`/officer/view-entries?document_set_id=${documentSetId}`)}
          >
            View Entry
          </Button>

          <Button disabled={processing || rateLoading} onClick={() => setShowConfirm(true)}>
            Compute Preview
          </Button>
        </div>
      </div>

      {/* CONFIRM MODAL */}
      {showConfirm && (
        <div
          style={styles.overlay}
          onClick={() => {
            if (!processing) setShowConfirm(false);
          }}
        >
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>Confirm Compute Preview</div>
              <div style={styles.modalSub}>
                This will compute / refresh the tax preview using the current exchange rate.
              </div>
            </div>

            <div style={styles.modalBody}>
              <div style={{ fontSize: 14, color: "#111827", lineHeight: 1.5 }}>
                Document Set: <strong>{documentSetId ?? "—"}</strong>
                <br />
                Exchange Rate: <strong>{exchangeRate === "" ? "—" : fmtNum(exchangeRate)}</strong> (
                {baseCurrency} → {quoteCurrency})
                <br />
                Mode: <strong>{officerRateMode}</strong>
              </div>

              {exchangeRate === "" && (
                <div style={{ marginTop: 12, fontSize: 13, color: "#b00020" }}>
                  Please enter a valid exchange rate.
                </div>
              )}
            </div>

            <div style={styles.modalFooter}>
              <button
                style={styles.btnSecondary}
                disabled={processing}
                onClick={() => setShowConfirm(false)}
              >
                Cancel
              </button>

              <button
                style={{
                  ...styles.btnPrimary,
                  opacity: processing || exchangeRate === "" ? 0.6 : 1,
                  cursor: processing || exchangeRate === "" ? "not-allowed" : "pointer",
                }}
                disabled={processing || exchangeRate === ""}
                onClick={computePreview}
              >
                {processing ? "Computing…" : "Compute Preview"}
              </button>

              <button
              style={{
                ...styles.btnPrimary,
                background: "#16a34a", // green = final
                opacity: processing ? 0.6 : 1,
              }}
              disabled={processing || rateLoading ||!previewRows.length}
              onClick={confirmComputation}
            >
              Confirm Final Computation
            </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}