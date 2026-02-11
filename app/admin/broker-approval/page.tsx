"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/app/lib/supabaseClient";
import Button from "@/app/components/Button";

const supabase = createClient();

type Broker = {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
  created_at?: string;
};

export default function BrokerApprovalPage() {
  const [pending, setPending] = useState<Broker[]>([]);
  const [history, setHistory] = useState<Broker[]>([]);

  useEffect(() => {
    fetchPending();
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPending = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("user_id, email, first_name, last_name, status, created_at")
      .eq("role", "BROKER")
      .eq("status", "PENDING")
      .order("created_at", { ascending: true });

    if (!error && data) setPending(data);
    if (error) setPending([]);
  };

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("user_id, email, first_name, last_name, status, created_at")
      .eq("role", "BROKER")
      .in("status", ["ACTIVE", "REJECTED"])
      .order("created_at", { ascending: false });

    if (!error && data) setHistory(data);
    if (error) setHistory([]);
  };

  const approveBroker = async (userId: string) => {
    await supabase.from("users").update({ status: "ACTIVE" }).eq("user_id", userId);
    fetchPending();
    fetchHistory();
  };

  const rejectBroker = async (userId: string) => {
    const reason = prompt("Reason for rejection:");
    if (!reason) return;

    await supabase.from("users").update({ status: "REJECTED" }).eq("user_id", userId);
    fetchPending();
    fetchHistory();
  };

  const exportCSV = (rows: Broker[], filename: string) => {
    if (!rows.length) return;

    const headers = ["User ID", "First Name", "Last Name", "Email", "Status", "Date"];
    const csvRows = rows.map((r) => [
      r.user_id,
      r.first_name,
      r.last_name,
      r.email,
      r.status,
      r.created_at ? new Date(r.created_at).toLocaleString() : "",
    ]);

    const csv = [headers, ...csvRows].map((row) => row.map((v) => `"${String(v ?? "")}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main style={styles.container}>
      {/* Pending */}
      <section style={styles.card}>
        <div style={styles.headerRow}>
          <h1 style={styles.title}>Pending Broker Applications</h1>
          <Button onClick={() => exportCSV(pending, "pending_brokers.csv")}>Export CSV</Button>
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>User ID</th>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Email</th>
                <th style={styles.thCenter}>Status</th>
                <th style={styles.thCenter}>Action</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((b) => (
                <tr key={b.user_id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={styles.userIdCell}>{b.user_id}</div>
                  </td>
                  <td style={styles.td}>
                    {b.first_name} {b.last_name}
                  </td>
                  <td style={styles.td}>{b.email}</td>
                  <td style={styles.centerCell}>
                    <span style={styles.pendingBadge}>{b.status}</span>
                  </td>
                  <td style={styles.centerCell}>
                    <div style={styles.actionGroup}>
                      <Button onClick={() => approveBroker(b.user_id)}>Approve</Button>
                      <Button variant="outline" onClick={() => rejectBroker(b.user_id)}>
                        Reject
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {pending.length === 0 && (
                <tr>
                  <td colSpan={5} style={styles.empty}>
                    No pending broker applications.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* History */}
      <section style={styles.card}>
        <div style={styles.headerRow}>
          <h1 style={styles.title}>Broker Decision History</h1>
          <Button onClick={() => exportCSV(history, "broker_history.csv")}>Export CSV</Button>
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>User ID</th>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Email</th>
                <th style={styles.thCenter}>Status</th>
                <th style={styles.thCenter}>Date</th>
              </tr>
            </thead>
            <tbody>
              {history.map((b) => (
                <tr key={b.user_id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={styles.userIdCell}>{b.user_id}</div>
                  </td>
                  <td style={styles.td}>
                    {b.first_name} {b.last_name}
                  </td>
                  <td style={styles.td}>{b.email}</td>
                  <td style={styles.centerCell}>
                    <span style={b.status === "ACTIVE" ? styles.activeBadge : styles.rejectedBadge}>
                      {b.status}
                    </span>
                  </td>
                  <td style={styles.centerCell}>{b.created_at ? new Date(b.created_at).toLocaleString() : ""}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={5} style={styles.empty}>
                    No broker decisions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: { padding: "32px", backgroundColor: "#ffffff", color: "#141414" },

  card: {
    backgroundColor: "#e8eef3",
    padding: "24px",
    borderRadius: "12px",
    marginBottom: "40px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },

  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
  title: { fontSize: "22px", fontWeight: "bold" },

  tableWrapper: { borderRadius: "8px", overflow: "hidden", backgroundColor: "#ffffff" },
  table: { width: "100%", borderCollapse: "collapse" },

  th: { textAlign: "left", padding: "12px", borderBottom: "1px solid #d6dde3", fontWeight: "bold", fontSize: "14px" },
  thCenter: { textAlign: "center", padding: "12px", borderBottom: "1px solid #d6dde3", fontWeight: "bold", fontSize: "14px" },

  tr: { borderBottom: "1px solid #d6dde3" },
  td: { padding: "12px", fontSize: "14px" },
  centerCell: { textAlign: "center", verticalAlign: "middle" },

  actionGroup: { display: "flex", justifyContent: "center", gap: "8px" },

  pendingBadge: { padding: "4px 10px", borderRadius: "999px", backgroundColor: "#8aa8c2", fontSize: "12px", fontWeight: "bold" },
  activeBadge: { padding: "4px 10px", borderRadius: "999px", backgroundColor: "#8aa8c2", fontSize: "12px", fontWeight: "bold" },
  rejectedBadge: { padding: "4px 10px", borderRadius: "999px", border: "1px solid #b00020", color: "#b00020", fontSize: "12px", fontWeight: "bold" },

  userIdCell: {
    maxWidth: "160px",
    overflowX: "auto",
    whiteSpace: "nowrap",
    fontFamily: "monospace",
    fontSize: "13px",
  },

  empty: { padding: "16px", textAlign: "center", fontStyle: "italic" },
};