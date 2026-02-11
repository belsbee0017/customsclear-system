"use client";

import { useState } from "react";
import { createClient } from "@/app/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";

export default function ConfirmAccountPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    alert("Account confirmed successfully. You may now log in.");
    router.replace("/login");
  };

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Account Confirmation</h1>

        <p style={styles.subtitle}>
          To activate your account, please create a password.
          <br />
          Your password must be at least <strong>8 characters</strong>.
        </p>

        <form onSubmit={handleConfirm}>
          <label style={styles.label}>New Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            required
          />

          <label style={styles.label}>Confirm Password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            style={styles.input}
            required
          />

          {error && <p style={styles.error}>{error}</p>}

          <div style={styles.buttonWrap}>
            <Button type="submit" disabled={loading}>
              {loading ? "Activating Account…" : "Confirm Account"}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}

/* ===============================
   STRICT BRAND KIT (SENIOR-FRIENDLY)
   =============================== */

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: "calc(100vh - 64px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
    color: "#141414"
  },

  card: {
    width: "100%",
    maxWidth: "440px",
    padding: "32px",
    borderRadius: "12px",
    backgroundColor: "#e8eef3",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
  },

  title: {
    fontSize: "24px",
    fontWeight: "bold",
    marginBottom: "10px"
  },

  subtitle: {
    fontSize: "15px",
    marginBottom: "24px",
    lineHeight: "1.6"
  },

  label: {
    display: "block",
    fontSize: "16px",
    fontWeight: "bold",
    marginTop: "18px",
    marginBottom: "6px"
  },

  input: {
    width: "100%",
    padding: "12px",
    fontSize: "16px",
    borderRadius: "8px",
    border: "1px solid #8aa8c2",
    backgroundColor: "#ffffff",
    outline: "none"
  },

  error: {
    marginTop: "16px",
    fontSize: "14px",
    color: "#b00020"
  },

  buttonWrap: {
    marginTop: "28px",
    display: "flex",
    justifyContent: "center"
  }
};