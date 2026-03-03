"use client";

import { useState } from "react";
import { createClient } from "@/app/lib/supabaseClient";
import Button from "@/app/components/Button";

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Forgot Password</h1>

        {sent ? (
          <>
            <p style={styles.sentText}>
              If an account exists for <strong>{email}</strong>, a password
              reset link has been sent. Check your inbox.
            </p>
            <a href="/login" style={styles.backLink}>
              ← Back to Login
            </a>
          </>
        ) : (
          <form onSubmit={sendReset}>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              required
              disabled={loading}
              placeholder="Enter your registered email"
            />

            {error && <p style={styles.error}>{error}</p>}

            <div style={{ marginTop: 18 }}>
              <Button type="submit" disabled={loading}>
                {loading ? "Sending…" : "Send Reset Link"}
              </Button>
            </div>

            <div style={{ marginTop: 16 }}>
              <a href="/login" style={styles.backLink}>
                ← Back to Login
              </a>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
    color: "#141414",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#e8eef3",
    padding: "32px",
    borderRadius: 12,
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  label: {
    display: "block",
    fontWeight: 700,
    fontSize: 14,
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: 12,
    fontSize: 15,
    borderRadius: 8,
    border: "1px solid #8aa8c2",
    backgroundColor: "#ffffff",
    outline: "none",
  },
  error: {
    color: "#b00020",
    fontSize: 13,
    marginTop: 10,
  },
  sentText: {
    fontSize: 14,
    lineHeight: 1.6,
    marginBottom: 20,
  },
  backLink: {
    fontSize: 13,
    color: "#2563eb",
    textDecoration: "none",
    display: "inline-block",
  },
};