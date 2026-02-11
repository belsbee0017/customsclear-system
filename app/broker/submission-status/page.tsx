"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabaseClient";

/* ===============================
   STATUS EXPLANATIONS (TEXT ONLY)
   =============================== */

   const STATUS_EXPLANATIONS: Record<string, string> = {
  pending: "Your submission has been received and is awaiting initial review.",
  for_review: "Your submission is currently under review by Customs.",
  validated: "Your submission has been validated. You may proceed to tax computation confirmation.",
  completed: "Final tax computation has been confirmed by Customs.",
  error: "An issue was identified during validation.",
};

type Submission = {
  document_set_id: string;
  created_at: string;
  status: string;
  has_computation?: boolean;
};

function normStatus(s: string | null | undefined) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

export default function SubmissionStatusPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  useEffect(() => {
    const fetchSubmissions = async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      // ✅ Correct: one row per document_set
      const { data, error } = await supabase
      .from("document_sets")
      .select(`
        document_set_id,
        created_at,
        status,
        tax_computation ( tax_id )
      `)
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });

      if (!error && data) {
      const shaped = (data as any[]).map((r) => ({
        document_set_id: r.document_set_id,
        created_at: r.created_at,
        status: r.status,
        has_computation: Array.isArray(r.tax_computation) && r.tax_computation.length > 0,
      }));
      setSubmissions(shaped);
    }

      setLoading(false);
    };

    fetchSubmissions();
  }, [router]);

  if (loading) {
    return (
      <main style={styles.container}>
        <div style={styles.card}>Loading submissions…</div>
      </main>
    );
  }

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Submission Status</h1>
        <p style={styles.subtitle}>
          Track the status of your submitted formal entries.
        </p>

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
            {submissions.length === 0 && (
              <tr>
                <td colSpan={4} style={styles.emptyRow}>
                  No submissions found.
                </td>
              </tr>
            )}

            {submissions.map((entry) => (
              <tr key={entry.document_set_id}>
                <td style={styles.tdMono}>
                  {entry.document_set_id}
                </td>

                <td style={styles.td}>
                  {new Date(entry.created_at).toLocaleDateString()}
                </td>

                <td style={styles.td}>

                {(() => {
                  const raw = normStatus(entry.status);
                  const displayKey = entry.has_computation ? "completed" : raw;

                  return (
                    <>
                      <strong>{displayKey.replace(/_/g, " ").toUpperCase()}</strong>
                      <div style={styles.statusText}>
                        {STATUS_EXPLANATIONS[displayKey] ?? "Status update pending."}
                      </div>
                    </>
                  );
                })()}


                </td>

                <td style={styles.td}>
                  <button
                    style={styles.viewLink}
                    onClick={() =>
                      router.push(
                        `/broker/submission-status/view?document_set_id=${entry.document_set_id}`
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
    maxWidth: "1100px",
    margin: "0 auto",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
  },

  title: {
    fontSize: "26px",
    fontWeight: "bold",
    marginBottom: "6px"
  },

  subtitle: {
    fontSize: "15px",
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

  statusText: {
    fontSize: "13px",
    marginTop: "6px",
    color: "#333"
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