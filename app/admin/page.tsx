"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/app/lib/supabaseClient";

type Broker = {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: "PENDING" | "ACTIVE" | "REJECTED" | string;
};

export default function AdminBrokerApprovalPage() {
  const supabase = useMemo(() => createClient(), []);

  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingBrokers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPendingBrokers = async () => {
    setLoading(true);
    setErrMsg(null);

    const { data, error } = await supabase
      .from("users")
      .select("user_id, email, first_name, last_name, status")
      .eq("role", "BROKER")
      .eq("status", "PENDING")
      .order("created_at", { ascending: true });

    if (error) setErrMsg(error.message);
    setBrokers((data as Broker[]) ?? []);
    setLoading(false);
  };

  const approveBroker = async (user_id: string) => {
    setWorkingId(user_id);
    setErrMsg(null);

    const { error } = await supabase
      .from("users")
      .update({ status: "ACTIVE" })
      .eq("user_id", user_id);

    if (error) {
      setErrMsg(error.message);
      setWorkingId(null);
      return;
    }

    // optional: write audit log (may be blocked by RLS)
    await supabase.from("audit_logs").insert({
      user_id: null,
      action: "BROKER_APPROVED",
      reference_type: "USER",
      reference_id: user_id,
      actor_role: "ADMIN",
      remarks: "Approved via Admin Broker Approval page",
    });

    setBrokers((prev) => prev.filter((b) => b.user_id !== user_id));
    setWorkingId(null);
  };

  const rejectBroker = async (user_id: string) => {
    const reason = prompt("Reason for rejection:");
    if (!reason?.trim()) return;

    setWorkingId(user_id);
    setErrMsg(null);

    const { error } = await supabase
      .from("users")
      .update({ status: "REJECTED" })
      .eq("user_id", user_id);

    if (error) {
      setErrMsg(error.message);
      setWorkingId(null);
      return;
    }

    await supabase.from("audit_logs").insert({
      user_id: null,
      action: "BROKER_REJECTED",
      reference_type: "USER",
      reference_id: user_id,
      actor_role: "ADMIN",
      remarks: reason.trim(),
    });

    setBrokers((prev) => prev.filter((b) => b.user_id !== user_id));
    setWorkingId(null);
  };

  return (
    <main style={styles.container}>
      <h1 style={styles.title}>Broker Approval</h1>

      {errMsg && <div style={styles.error}>{errMsg}</div>}

      {loading && <p style={styles.text}>Loading pending brokers...</p>}

      {!loading && brokers.length === 0 && (
        <p style={styles.text}>No pending broker registrations.</p>
      )}

      {!loading &&
        brokers.map((broker) => (
          <div key={broker.user_id} style={styles.card}>
            <div>
              <div style={styles.name}>
                {(broker.first_name ?? "—")} {(broker.last_name ?? "")}
              </div>
              <div style={styles.email}>{broker.email}</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                <strong>Status:</strong> {broker.status}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => approveBroker(broker.user_id)}
                disabled={workingId === broker.user_id}
                style={styles.button}
              >
                {workingId === broker.user_id ? "Working…" : "Approve"}
              </button>

              <button
                onClick={() => rejectBroker(broker.user_id)}
                disabled={workingId === broker.user_id}
                style={styles.buttonOutline}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
    </main>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    padding: "32px",
    backgroundColor: "#ffffff",
    color: "#141414",
    minHeight: "calc(100vh - 64px)",
  },

  title: {
    fontSize: "24px",
    fontWeight: "bold",
    marginBottom: "24px",
  },

  text: {
    fontSize: "16px",
    marginBottom: "16px",
  },

  error: {
    marginBottom: 12,
    padding: "10px 12px",
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    borderRadius: 8,
    fontSize: 13,
    color: "#b00020",
    fontWeight: 800,
  },

  card: {
    backgroundColor: "#e8eef3",
    padding: "16px 20px",
    borderRadius: "8px",
    marginBottom: "12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  },

  name: {
    fontSize: "16px",
    fontWeight: "bold",
  },

  email: {
    fontSize: "14px",
    marginTop: "4px",
  },

  button: {
    padding: "8px 16px",
    borderRadius: "6px",
    border: "none",
    backgroundColor: "#8aa8c2",
    color: "#141414",
    fontWeight: "bold",
    cursor: "pointer",
  },

  buttonOutline: {
    padding: "8px 16px",
    borderRadius: "6px",
    border: "1px solid #8aa8c2",
    backgroundColor: "transparent",
    color: "#141414",
    fontWeight: "bold",
    cursor: "pointer",
  },
};