"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabaseClient";
import Button from "@/app/components/Button";

function validatePassword(pw: string) {
  if (pw.length < 12) return "Password must be at least 12 characters.";
  if (!/[A-Z]/.test(pw)) return "Must include an uppercase letter.";
  if (!/[a-z]/.test(pw)) return "Must include a lowercase letter.";
  if (!/\d/.test(pw)) return "Must include a number.";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Must include a special character.";
  return null;
}

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null = checking, true = recovery session active, false = invalid/expired
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    // Listen for the PASSWORD_RECOVERY event which fires when the reset link is opened
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    // Also check for an existing session (user already verified via link)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady((prev) => prev ?? true);
      else setReady((prev) => prev ?? false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const update = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const v = validatePassword(password);
    if (v) return setError(v);
    if (password !== confirm) return setError("Passwords do not match.");

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    router.replace("/login");
  };

  // Checking session state
  if (ready === null) {
    return (
      <main style={styles.container}>
        <div style={styles.card}>
          <p style={{ fontSize: 14, color: "#555" }}>Verifying reset link…</p>
        </div>
      </main>
    );
  }

  // Invalid / expired link
  if (!ready) {
    return (
      <main style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Reset Password</h1>
          <p style={{ fontSize: 14, color: "#b00020", marginBottom: 20 }}>
            Invalid or expired reset link. Please request a new one.
          </p>
          <a href="/forgot-password" style={styles.link}>
            Request a new reset link
          </a>
          <div style={{ marginTop: 12 }}>
            <a href="/login" style={styles.link}>
              ← Back to Login
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Reset Password</h1>
        <p style={{ fontSize: 13, color: "#555", marginBottom: 20 }}>
          Choose a strong password with at least 12 characters, including
          uppercase, lowercase, a number, and a special character.
        </p>

        <form onSubmit={update}>
          <label style={styles.label}>New Password</label>
          <div style={styles.passwordWrapper}>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              disabled={loading}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={styles.showBtn}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <label style={{ ...styles.label, marginTop: 14 }}>Confirm Password</label>
          <div style={styles.passwordWrapper}>
            <input
              type={showConfirm ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={styles.input}
              disabled={loading}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              style={styles.showBtn}
            >
              {showConfirm ? "Hide" : "Show"}
            </button>
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <div style={{ marginTop: 20 }}>
            <Button type="submit" disabled={loading}>
              {loading ? "Updating…" : "Update Password"}
            </Button>
          </div>

          <div style={{ marginTop: 16 }}>
            <a href="/login" style={styles.link}>
              ← Back to Login
            </a>
          </div>
        </form>
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
    maxWidth: 480,
    backgroundColor: "#e8eef3",
    padding: "32px",
    borderRadius: 12,
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  label: {
    display: "block",
    fontWeight: 700,
    fontSize: 14,
    marginBottom: 6,
  },
  passwordWrapper: {
    position: "relative",
    width: "100%",
  },
  input: {
    width: "100%",
    padding: "12px",
    paddingRight: 64,
    fontSize: 15,
    borderRadius: 8,
    border: "1px solid #8aa8c2",
    backgroundColor: "#ffffff",
    outline: "none",
  },
  showBtn: {
    position: "absolute",
    right: 10,
    top: "50%",
    transform: "translateY(-50%)",
    border: "none",
    background: "transparent",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    color: "#141414",
  },
  error: {
    color: "#b00020",
    fontSize: 13,
    marginTop: 10,
  },
  link: {
    fontSize: 13,
    color: "#2563eb",
    textDecoration: "none",
    display: "inline-block",
  },
};
