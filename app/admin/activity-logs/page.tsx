"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/app/lib/supabaseClient";

const supabase = createClient();

type Log = {
  log_id: string;
  user_id: string | null;
  actor_role: string;
  action: string;
  reference_type: string;
  reference_id: string | null;
  created_at: string;
};

const PAGE_SIZE = 20;

export default function AdminActivityLogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [page, setPage] = useState(0);

  // filters
  const [action, setAction] = useState("");
  const [actorRole, setActorRole] = useState("");
  const [userId, setUserId] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // ✅ when filters change, go back to page 1
  useEffect(() => {
    setPage(0);
  }, [action, actorRole, userId, referenceId, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, action, actorRole, userId, referenceId, dateFrom, dateTo]);

  const fetchLogs = async () => {
    let query = supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (action) query = query.eq("action", action);
    if (actorRole) query = query.eq("actor_role", actorRole);

    // ✅ UUID fields: use eq (ilike on uuid can break)
    if (userId) query = query.eq("user_id", userId);
    if (referenceId) query = query.eq("reference_id", referenceId);

    // ✅ date inputs are YYYY-MM-DD; make To inclusive (end of day)
    if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00.000Z`);
    if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59.999Z`);

    const { data, error } = await query;
    if (!error && data) setLogs(data);
    if (error) setLogs([]);
  };

  return (
    <main style={styles.container}>
      <h1 style={styles.title}>System Activity Logs</h1>

      {/* Filters */}
      <div style={styles.filterRow}>
        <select style={styles.input} value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">All Actions</option>
          <option value="VALIDATION_TRIGGERED">VALIDATION_TRIGGERED</option>
          <option value="FIELD_FINAL_VALUE_UPDATED">FIELD_FINAL_VALUE_UPDATED</option>
          <option value="BROKER_APPROVED">BROKER_APPROVED</option>
          <option value="COMPUTATION_CONFIRMED">COMPUTATION_CONFIRMED</option>
        </select>

        <select style={styles.input} value={actorRole} onChange={(e) => setActorRole(e.target.value)}>
          <option value="">All Roles</option>
          <option value="ADMIN">ADMIN</option>
          <option value="CUSTOMS_OFFICER">CUSTOMS_OFFICER</option>
          <option value="SYSTEM">SYSTEM</option>
        </select>

        <input
          type="text"
          placeholder="User ID (exact UUID)"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          style={styles.input}
        />

        <input
          type="text"
          placeholder="Reference ID (exact UUID)"
          value={referenceId}
          onChange={(e) => setReferenceId(e.target.value)}
          style={styles.input}
        />

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          style={styles.input}
        />

        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          style={styles.input}
        />
      </div>

      {/* Table */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Action</th>
              <th style={styles.th}>Actor Role</th>
              <th style={styles.th}>User ID</th>
              <th style={styles.th}>Reference</th>
              <th style={styles.th}>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.log_id}>
                <td style={styles.td}>{log.action}</td>
                <td style={styles.td}>{log.actor_role}</td>
                <td style={styles.td}>
                  <div style={styles.userIdCell}>{log.user_id ?? "SYSTEM"}</div>
                </td>
                <td style={styles.td}>
                  {log.reference_type}
                  {log.reference_id ? ` (${log.reference_id})` : ""}
                </td>
                <td style={styles.td}>{new Date(log.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} style={styles.empty}>No logs found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={styles.pagination}>
        <button
          style={styles.pageBtn}
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </button>
        <span style={styles.pageText}>Page {page + 1}</span>
        <button
          style={styles.pageBtn}
          disabled={logs.length < PAGE_SIZE}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </main>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: { padding: "32px", backgroundColor: "#ffffff", color: "#141414" },
  title: { fontSize: "24px", fontWeight: "bold", marginBottom: "16px" },

  filterRow: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: "12px",
    marginBottom: "20px"
  },

  input: {
    padding: "8px",
    borderRadius: "6px",
    border: "1px solid #8aa8c2",
    fontSize: "14px"
  },

  tableWrapper: {
    backgroundColor: "#e8eef3",
    borderRadius: "8px",
    overflow: "hidden"
  },

  table: { width: "100%", borderCollapse: "collapse" },

  th: { padding: "12px", borderBottom: "1px solid #d6dde3", fontWeight: "bold" },
  td: { padding: "12px", borderBottom: "1px solid #d6dde3", fontSize: "14px" },

  userIdCell: {
    maxWidth: "180px",
    overflowX: "auto",
    whiteSpace: "nowrap",
    fontFamily: "monospace"
  },

  empty: { textAlign: "center", padding: "16px", fontStyle: "italic" },

  pagination: {
    marginTop: "16px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "12px"
  },

  pageBtn: {
    padding: "6px 12px",
    borderRadius: "6px",
    border: "none",
    backgroundColor: "#8aa8c2",
    fontWeight: "bold",
    cursor: "pointer"
  },

  pageText: { fontWeight: "bold" }
};