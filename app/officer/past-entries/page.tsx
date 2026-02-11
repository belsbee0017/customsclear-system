"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { createClient } from "@/app/lib/supabaseClient";

type AuditRow = {
  log_id: string;
  created_at: string;
  action: string | null;
  reference_type: string | null;
  reference_id: string | null;
  actor_role: string | null;
  remarks: string | null;
  user_id: string | null;
};

export default function OfficerPastEntriesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<AuditRow[]>([]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);

      // must be logged in
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        router.replace("/login");
        return;
      }

      // (optional) role guard (client-side)
      const { data: me, error: meErr } = await supabase
        .from("users")
        .select("role")
        .eq("user_id", auth.user.id)
        .single();

      if (meErr) {
        setError(meErr.message);
        setLoading(false);
        return;
      }
      if (me?.role !== "CUSTOMS_OFFICER") {
        router.replace("/login");
        return;
      }

      // 1) get logs
    const { data, error: qErr } = await supabase
    .from("audit_logs")
    .select("log_id, created_at, action, reference_type, reference_id, actor_role, remarks, user_id")
    .eq("actor_role", "CUSTOMS_OFFICER")
    .eq("reference_type", "DOCUMENT_SET")
    .order("created_at", { ascending: false })
    .limit(500);

    if (qErr) {
    setError(qErr.message);
    setRows([]);
    } else {
    // 2) keep ONLY latest log per reference_id (document_set_id)
    const seen = new Set<string>();
    const latestPerDocSet = (data ?? []).filter((r: any) => {
        const id = String(r.reference_id ?? "");
        if (!id) return false;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    });

  setRows(latestPerDocSet as AuditRow[]);
}

      setLoading(false);
    };

    run();
  }, [router]);

  if (loading) {
    return (
      <main style={styles.container}>
        <div style={styles.card}>Loading audit logs…</div>
      </main>
    );
  }

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>Officer Audit Logs</h1>
            <p style={styles.subtitle}>Recent officer actions recorded by the system.</p>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="outline" onClick={() => router.back()}>
              Back
            </Button>
          </div>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        <table style={styles.table}>
          <thead>
            <tr>
                <th style={styles.th}>Date/Time</th>
                <th style={styles.th}>Action</th>
                <th style={styles.th}>Entry No.</th>
                <th style={styles.th}>Remarks</th>
            </tr>
            </thead>

          <tbody>
            {rows.length === 0 ? (
                <tr>
                <td colSpan={4} style={styles.emptyRow}>No audit logs found.</td>
                </tr>
            ) : (
                rows.map((r) => (
                <tr key={r.log_id}>
                    <td style={styles.td}>
                    {new Date(r.created_at).toLocaleString()}
                    </td>

                    <td style={styles.td}>
                    <div style={{ fontWeight: 800 }}>{String(r.action ?? "—").replace(/_/g, " ")}</div>
                    <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                        {r.actor_role ?? "—"}
                    </div>
                    </td>

                    <td style={styles.tdMono}>
                    <button
                        style={styles.entryLink}
                        onClick={() =>
                        router.push(`/officer/view-entries?document_set_id=${r.reference_id}`)
                        }
                    >
                        {String(r.reference_id ?? "—")}
                    </button>
                    </td>

                    <td style={styles.td}>
                    {String(r.remarks ?? "—").length > 80
                        ? String(r.remarks).slice(0, 80) + "…"
                        : (r.remarks ?? "—")}
                    </td>
                    
                </tr>
                ))
            )}
            </tbody>
        </table>
      </div>
    </main>
  );
}

/* ===============================
   STYLES (matches your gov UI vibe)
================================ */
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    padding: "32px",
    backgroundColor: "#ffffff",
    minHeight: "calc(100vh - 64px)",
    color: "#141414",
  },

  card: {
    backgroundColor: "#e8eef3",
    borderRadius: "12px",
    padding: "32px",
    maxWidth: "1200px",
    margin: "0 auto",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  },

  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "18px",
    gap: 12,
  },

  title: {
    fontSize: "26px",
    fontWeight: "bold",
    marginBottom: "6px",
  },

  subtitle: {
    fontSize: "15px",
    marginBottom: 0,
  },

  errorBox: {
    background: "#fff",
    border: "1px solid #d6dde3",
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    color: "#b00020",
    fontWeight: 700,
    fontSize: 13,
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    overflow: "hidden",
  },

  th: {
    textAlign: "left",
    padding: "14px",
    borderBottom: "1px solid #d6dde3",
    fontWeight: "bold",
    fontSize: 13,
  },

  td: {
    padding: "14px",
    borderBottom: "1px solid #e1e6eb",
    verticalAlign: "top",
    fontSize: 13,
  },

  tdMono: {
    padding: "14px",
    borderBottom: "1px solid #e1e6eb",
    verticalAlign: "top",
    fontFamily: "monospace",
    fontSize: "12.5px",
  },

  smallText: {
    marginTop: 6,
    fontSize: 12,
    color: "#333",
  },

  emptyRow: {
    padding: "20px",
    textAlign: "center",
    fontStyle: "italic",
  },

  entryLink: {
  background: "none",
  border: "none",
  padding: 0,
  fontFamily: "monospace",
  fontSize: "13px",
  fontWeight: 800,
  textDecoration: "underline",
  cursor: "pointer",
  color: "#141414",
},

};