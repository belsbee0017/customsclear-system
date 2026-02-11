"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabaseClient";
import Button from "@/app/components/Button";

export default function AdminLoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.replace("/admin");
  };

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>System Administrator Login</h1>
        <p style={styles.subtitle}>
          This page is restricted to system administrators only.
        </p>

        <form onSubmit={handleLogin}>
          {/* EMAIL */}
          <label style={styles.label}>Admin Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required
          />

          {/* PASSWORD */}
          <label style={styles.label}>Password</label>
          <div style={styles.passwordWrapper}>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.passwordInput}
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

          {error && <p style={styles.error}>{error}</p>}

          <div style={styles.buttonWrapper}>
            <Button type="submit" disabled={loading}>
              {loading ? "Logging in…" : "Log In as Admin"}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}

/* ===============================
   STYLES — FIXED & STABLE
   =============================== */

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
    color: "#141414"
  },

  card: {
    width: "100%",
    maxWidth: "420px",
    padding: "32px",
    borderRadius: "12px",
    backgroundColor: "#e8eef3",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
  },

  title: {
    fontSize: "24px",
    fontWeight: "bold",
    marginBottom: "6px"
  },

  subtitle: {
    fontSize: "14px",
    marginBottom: "24px"
  },

  label: {
    display: "block",
    fontSize: "14px",
    marginBottom: "6px",
    marginTop: "16px",
    fontWeight: "bold"
  },

  input: {
    width: "100%",
    padding: "12px",
    fontSize: "15px",
    borderRadius: "8px",
    border: "1px solid #8aa8c2",
    backgroundColor: "#ffffff",
    outline: "none"
  },

  passwordWrapper: {
    position: "relative",
    width: "100%"
  },

  passwordInput: {
    width: "100%",
    padding: "12px",
    paddingRight: "64px",
    fontSize: "15px",
    borderRadius: "8px",
    border: "1px solid #8aa8c2",
    backgroundColor: "#ffffff",
    outline: "none"
  },

  showBtn: {
    position: "absolute",
    right: "10px",
    top: "50%",
    transform: "translateY(-50%)",
    border: "none",
    background: "transparent",
    fontSize: "13px",
    fontWeight: "bold",
    cursor: "pointer",
    color: "#141414"
  },

  buttonWrapper: {
    marginTop: "28px",
    display: "flex",
    justifyContent: "center"
  },

  error: {
    marginTop: "14px",
    fontSize: "13px",
    color: "#b00020"
  }
};