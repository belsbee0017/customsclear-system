"use client";

import { useState } from "react";
import { createClient } from "@/app/lib/supabaseClient";
import Button from "@/app/components/Button";
import { useRouter } from "next/navigation";

function validatePassword(pw: string) {
  if (pw.length < 12) return "Password must be at least 12 characters.";
  if (!/[A-Z]/.test(pw)) return "Must include an uppercase letter.";
  if (!/[a-z]/.test(pw)) return "Must include a lowercase letter.";
  if (!/\d/.test(pw)) return "Must include a number.";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Must include a special character.";
  return null;
}

type Props = {
  onClose: () => void;
};

export default function ChangePasswordModal({ onClose }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
  setError(null);

  /* ⬇️ ADD HERE /
  const validationError = validatePassword(password);
  if (validationError) {
    setError(validationError);
    return;
  }

  if (password !== confirm) {
    setError("Passwords do not match.");
    return;
  }
  / ⬆️ END */

  setLoading(true);

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    setError(error.message);
    setLoading(false);
    return;
  }

  await supabase.auth.signOut();
  onClose();
  router.replace("/login");
};

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h2 style={styles.title}>Change Password</h2>

        <label style={styles.label}>New Password</label>
        <input
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
          disabled={loading}
        />

        {/* OPTIONAL UI HELPER TEXT */}
        <p style={styles.helperText}>
          Password must be at least 8 characters and include uppercase, lowercase,
          number, and special character.
        </p>

        <label style={styles.label}>Confirm New Password</label>
        <input
          type={showPassword ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          style={styles.input}
          disabled={loading}
        />

        <div style={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={showPassword}
            onChange={() => setShowPassword(!showPassword)}
          />
          <span style={styles.checkboxLabel}>Show password</span>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.actions}>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleChangePassword} disabled={loading}>
            {loading ? "Updating…" : "Update Password"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ===============================
   STYLES — MODAL
   =============================== */

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999
  },

  modal: {
    width: "100%",
    maxWidth: "420px",
    backgroundColor: "#e8eef3",
    padding: "24px",
    borderRadius: "10px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.2)"
  },

  title: {
    fontSize: "20px",
    fontWeight: "bold",
    marginBottom: "16px"
  },

  label: {
    fontSize: "14px",
    fontWeight: "bold",
    display: "block",
    marginTop: "12px",
    marginBottom: "6px"
  },

  input: {
    width: "100%",
    padding: "10px",
    fontSize: "14px",
    borderRadius: "6px",
    border: "1px solid #8aa8c2",
    backgroundColor: "#ffffff"
  },

  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "10px"
  },

  checkboxLabel: {
    fontSize: "13px"
  },

  error: {
    marginTop: "12px",
    color: "#b00020",
    fontSize: "14px"
  },

  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "20px"
  },

  helperText: {
  fontSize: "12px",
  color: "#555",
  marginTop: "6px",
  lineHeight: 1.4
}

};
