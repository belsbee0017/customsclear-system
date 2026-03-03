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

type ModalState =
  | { type: "approve"; broker: Broker }
  | { type: "reject"; broker: Broker }
  | null;

export default function AdminBrokerApprovalPage() {
  const supabase = useMemo(() => createClient(), []);

  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);

  // Modal state
  const [modal, setModal] = useState<ModalState>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [modalErr, setModalErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAdminUserId(data.user?.id ?? null);
    });
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

  const closeModal = () => {
    setModal(null);
    setRejectReason("");
    setModalErr(null);
  };

  const confirmApprove = async () => {
    if (!modal || modal.type !== "approve") return;
    const { user_id } = modal.broker;

    setWorkingId(user_id);
    setModalErr(null);

    const { error } = await supabase
      .from("users")
      .update({ status: "ACTIVE" })
      .eq("user_id", user_id);

    if (error) {
      setModalErr(error.message);
      setWorkingId(null);
      return;
    }

    await supabase.from("audit_logs").insert({
      user_id: adminUserId,
      action: "BROKER_APPROVED",
      reference_type: "USER",
      reference_id: user_id,
      actor_role: "ADMIN",
      remarks: "Approved via Admin Broker Approval page",
    });

    setBrokers((prev) => prev.filter((b) => b.user_id !== user_id));
    setWorkingId(null);
    closeModal();
  };

  const confirmReject = async () => {
    if (!modal || modal.type !== "reject") return;
    if (!rejectReason.trim()) {
      setModalErr("Please provide a reason for rejection.");
      return;
    }

    const { user_id } = modal.broker;
    setWorkingId(user_id);
    setModalErr(null);

    const { error } = await supabase
      .from("users")
      .update({ status: "REJECTED" })
      .eq("user_id", user_id);

    if (error) {
      setModalErr(error.message);
      setWorkingId(null);
      return;
    }

    await supabase.from("audit_logs").insert({
      user_id: adminUserId,
      action: "BROKER_REJECTED",
      reference_type: "USER",
      reference_id: user_id,
      actor_role: "ADMIN",
      remarks: rejectReason.trim(),
    });

    setBrokers((prev) => prev.filter((b) => b.user_id !== user_id));
    setWorkingId(null);
    closeModal();
  };

  return (
    <main style={styles.container}>
      <h1 style={styles.title}>Broker Approval</h1>
      <p style={{ fontSize: 14, color: "#555", marginBottom: 24 }}>
        Review and approve or reject pending broker account registrations.
      </p>

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
                {broker.first_name ?? "—"} {broker.last_name ?? ""}
              </div>
              <div style={styles.email}>{broker.email}</div>
              <div style={{ fontSize: 12, marginTop: 4, color: "#555" }}>
                Status: <strong>{broker.status}</strong>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setModal({ type: "approve", broker })}
                disabled={workingId === broker.user_id}
                style={styles.button}
              >
                Approve
              </button>

              <button
                onClick={() => { setModal({ type: "reject", broker }); setRejectReason(""); setModalErr(null); }}
                disabled={workingId === broker.user_id}
                style={styles.buttonOutline}
              >
                Reject
              </button>
            </div>
          </div>
        ))}

      {/* =====================
          CONFIRMATION MODAL
      ===================== */}
      {modal && (
        <div style={styles.overlay} onClick={closeModal}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={styles.modalHeader}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>
                {modal.type === "approve" ? "Approve Broker" : "Reject Broker"}
              </div>
              <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>
                {modal.broker.first_name ?? ""} {modal.broker.last_name ?? ""} — {modal.broker.email}
              </div>
            </div>

            {/* Body */}
            <div style={styles.modalBody}>
              {modal.type === "approve" ? (
                <p style={{ fontSize: 14, color: "#111827", lineHeight: 1.6 }}>
                  Are you sure you want to <strong>approve</strong> this broker? Their
                  account will become active and they will be able to log in.
                </p>
              ) : (
                <>
                  <p style={{ fontSize: 14, color: "#111827", marginBottom: 12 }}>
                    Provide a reason for rejecting this registration:
                  </p>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. Incomplete information, duplicate account…"
                    style={styles.textarea}
                    rows={3}
                  />
                </>
              )}

              {modalErr && (
                <p style={{ color: "#b00020", fontSize: 13, marginTop: 10 }}>{modalErr}</p>
              )}
            </div>

            {/* Footer */}
            <div style={styles.modalFooter}>
              <button onClick={closeModal} style={styles.cancelBtn} disabled={!!workingId}>
                Cancel
              </button>
              <button
                onClick={modal.type === "approve" ? confirmApprove : confirmReject}
                disabled={!!workingId}
                style={{
                  ...styles.confirmBtn,
                  backgroundColor: modal.type === "approve" ? "#16a34a" : "#b00020",
                  opacity: workingId ? 0.6 : 1,
                }}
              >
                {workingId
                  ? "Working…"
                  : modal.type === "approve"
                  ? "Confirm Approve"
                  : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
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
    marginBottom: "8px",
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
    backgroundColor: "#16a34a",
    color: "#ffffff",
    fontWeight: "bold",
    cursor: "pointer",
  },

  buttonOutline: {
    padding: "8px 16px",
    borderRadius: "6px",
    border: "1px solid #b00020",
    backgroundColor: "transparent",
    color: "#b00020",
    fontWeight: "bold",
    cursor: "pointer",
  },

  // Modal
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

  modalBox: {
    width: "100%",
    maxWidth: 500,
    background: "#ffffff",
    borderRadius: 12,
    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
    overflow: "hidden",
    border: "1px solid #e5e7eb",
  },

  modalHeader: {
    padding: "16px 20px",
    borderBottom: "1px solid #e5e7eb",
    background: "#f7f9fb",
  },

  modalBody: {
    padding: "20px",
  },

  modalFooter: {
    padding: "14px 20px",
    borderTop: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    background: "#fff",
  },

  textarea: {
    width: "100%",
    padding: 10,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 13,
    resize: "vertical" as const,
    outline: "none",
    background: "#f9fafb",
  },

  cancelBtn: {
    padding: "9px 14px",
    borderRadius: 8,
    background: "#e5e7eb",
    border: "1px solid #d1d5db",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13,
  },

  confirmBtn: {
    padding: "9px 14px",
    borderRadius: 8,
    border: "none",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 13,
  },
};
