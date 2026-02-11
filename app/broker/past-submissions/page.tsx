"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabaseClient";

type Submission = {
  document_set_id: string;
  created_at: string;
  status: string;
};

export default function BrokerPastSubmissionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<Submission[]>([]);
  const supabase = createClient();

  useEffect(() => {
    const fetchPast = async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data } = await supabase
        .from("document_sets")
        .select("document_set_id, created_at, status")
        .eq("created_by", user.id)
        .in("status", ["validated", "released", "completed"])
        .order("created_at", { ascending: false });

      setEntries(data ?? []);
      setLoading(false);
    };

    fetchPast();
  }, [router]);

  if (loading) {
    return (
      <main style={styles.container}>
        <div style={styles.card}>Loading past submissions…</div>
      </main>
    );
  }

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Past Submissions</h1>
        <p style={styles.subtitle}>
          Previously completed formal entries.
        </p>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Entry No.</th>
              <th style={styles.th}>Date Submitted</th>
              <th style={styles.th}>Final Status</th>
            </tr>
          </thead>

          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={3} style={styles.emptyRow}>
                  No completed submissions found.
                </td>
              </tr>
            )}

            {entries.map((e) => (
              <tr key={e.document_set_id}>
                <td style={styles.tdMono}>{e.document_set_id}</td>
                <td style={styles.td}>
                  {new Date(e.created_at).toLocaleDateString()}
                </td>
                <td style={styles.td}>
                  <StatusBadge status={e.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

/* ---------- HELPERS ---------- */

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={styles.badge}>
      {status.replace("_", " ").toUpperCase()}
    </span>
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
    borderBottom: "1px solid #d6dde3",
    fontWeight: "bold"
  },

  td: {
    padding: "14px",
    borderBottom: "1px solid #e1e6eb"
  },

  tdMono: {
    padding: "14px",
    borderBottom: "1px solid #e1e6eb",
    fontFamily: "monospace",
    fontSize: "13px"
  },

  emptyRow: {
    padding: "20px",
    textAlign: "center",
    fontStyle: "italic"
  },

  badge: {
    fontWeight: "bold",
    fontSize: "13px"
  }
};
