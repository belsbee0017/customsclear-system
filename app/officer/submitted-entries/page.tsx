"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabaseClient";
import Button from "@/app/components/Button";

/* ===============================
   TYPES
   =============================== */

type EntryRow = {
  document_set_id: string;
  created_at: string;
  status: string;
};

/* ===============================
   PAGE
   =============================== */

export default function OfficerSubmittedEntriesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<
  "ALL" | "PENDING" | "FOR_REVIEW"
>("ALL");

  useEffect(() => {
    const loadEntries = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      /**
       * ✅ CORRECT SOURCE OF TRUTH
       * Officer sees ALL document_sets
       * regardless of OCR / extracted_fields
       */
      const { data, error } = await supabase
        .from("document_sets")
        .select("document_set_id, created_at, status")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setEntries(data);
      }

      setLoading(false);
    };

    loadEntries();
  }, [router]);

  if (loading) {
    return (
      <main style={styles.container}>
        <div style={styles.card}>Loading submitted entries…</div>
      </main>
    );
  }

    const filteredEntries = entries.filter((entry) => {
      const status = String(entry.status ?? "").toLowerCase();

      if (statusFilter === "ALL") return true;
      if (statusFilter === "PENDING") return status === "pending";
      if (statusFilter === "FOR_REVIEW") return status === "for_review";

      return true;
    });


  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Submitted Formal Entries</h1>
        <p style={styles.subtitle}>
          Review formal entry submissions awaiting validation.
        </p>

        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>

        <Button
          variant={statusFilter === "ALL" ? "primary" : "outline"}
          onClick={() => setStatusFilter("ALL")}
        >
          All
        </Button>
        <Button
          variant={statusFilter === "PENDING" ? "primary" : "outline"}
          onClick={() => setStatusFilter("PENDING")}
        >
          Pending
        </Button>
        <Button
          variant={statusFilter === "FOR_REVIEW" ? "primary" : "outline"}
          onClick={() => setStatusFilter("FOR_REVIEW")}
        >
          For Review
        </Button>
      </div>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Entry No.</th>
              <th style={styles.th}>Date Submitted</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Action</th>
            </tr>
          </thead>

          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={4} style={styles.emptyRow}>
                  No submissions found.
                </td>
              </tr>
            )}

            {filteredEntries.map((entry) => (
              <tr key={entry.document_set_id}>
                <td style={styles.tdMono}>
                  {entry.document_set_id}
                </td>

                <td style={styles.td}>
                  {new Date(entry.created_at).toLocaleString()}
                </td>

                <td style={styles.td}>
                  <strong>
                    {entry.status.replace("_", " ").toUpperCase()}
                  </strong>
                </td>

                <td style={styles.td}>
                  <button
                    style={styles.viewLink}
                    onClick={() =>
                      router.push(
                        `/officer/view-entries?document_set_id=${entry.document_set_id}`
                      )
                    }
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

/* ===============================
   STRICT BRAND KIT STYLES
   =============================== */

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    padding: "32px",
    backgroundColor: "#ffffff",
    minHeight: "calc(100vh - 64px)",
    color: "#141414"
  },

  card: {
    backgroundColor: "#e8eef3",
    borderRadius: "12px",
    padding: "32px",
    maxWidth: "1200px",
    margin: "0 auto",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
  },

  title: {
    fontSize: "28px",
    fontWeight: "bold",
    marginBottom: "6px"
  },

  subtitle: {
    fontSize: "16px",
    marginBottom: "24px"
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    overflow: "hidden"
  },

  th: {
    textAlign: "left",
    padding: "14px",
    fontWeight: "bold",
    borderBottom: "1px solid #d6dde3"
  },

  td: {
    padding: "14px",
    borderBottom: "1px solid #e1e6eb",
    verticalAlign: "top"
  },

  tdMono: {
    padding: "14px",
    borderBottom: "1px solid #e1e6eb",
    fontFamily: "monospace",
    fontSize: "13px"
  },

  viewLink: {
    background: "none",
    border: "none",
    fontWeight: "bold",
    textDecoration: "underline",
    cursor: "pointer",
    color: "#141414"
  },

  emptyRow: {
    padding: "20px",
    textAlign: "center",
    fontStyle: "italic"
  }
};
