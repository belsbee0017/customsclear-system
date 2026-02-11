"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabaseClient";
import Button from "@/app/components/Button";

export default function LoginPage() {
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

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInErr) {
      setError(signInErr.message);
      setLoading(false);
      return;
    }

    // ✅ Role-based redirect (BROKER / OFFICER only)
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setError("No active session. Please try again.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profErr } = await supabase
      .from("users")
      .select("role, status")
      .eq("user_id", session.user.id)
      .single();

    if (profErr || !profile) {
      await supabase.auth.signOut();
      setError("Account profile not found. Please contact support.");
      setLoading(false);
      return;
    }

    if (profile.status !== "ACTIVE") {
      await supabase.auth.signOut();
      setError("Your account is not yet active.");
      setLoading(false);
      return;
    }

    if (profile.role === "BROKER") {
      router.replace("/broker");
      return;
    }

    if (profile.role === "CUSTOMS_OFFICER") {
      router.replace("/officer/home");
      return;
    }

    // ✅ Not allowed here (ADMIN or others)
    await supabase.auth.signOut();
    setError("This login is for Brokers and Customs Officers only.");
    setLoading(false);
  };

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>System Login</h1>
        <p style={styles.subtitle}>
          Authorized access for registered <strong>Brokers</strong> and{" "}
          <strong>Customs Officers</strong>.
        </p>

        <div style={styles.noteBox}>
          <div style={styles.noteTitle}>Important</div>
          <div style={styles.noteText}>
            Your dashboard is determined automatically based on your account role after you sign in.
          </div>
        </div>

        <form onSubmit={handleLogin}>
          {/* EMAIL */}
          <label style={styles.label}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required
          />

          {/* PASSWORD */}
          <label style={styles.label}>Password</label>
          <div style={styles.passwordWrap}>
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

          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.actions}>
            <Button type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </div>

          <button
          type="button"
          onClick={() => router.push("/forgot-password")}
          style={{ marginTop: 10, 
                   background: "none", 
                   border: "none", 
                   textDecoration: "underline", 
                   fontWeight: 700, 
                   cursor: "pointer" }}
        >
          Forgot password?
        </button>

        </form>
      </div>
    </main>
  );
}

/* ===============================
   STYLES — GOV / ENTERPRISE
   =============================== */
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#ffffff",
    color: "#141414",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  card: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#e8eef3",
    borderRadius: 12,
    padding: 32,
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  },

  title: {
    fontSize: 26,
    fontWeight: 800,
    margin: 0,
  },

  subtitle: {
    marginTop: 8,
    marginBottom: 18,
    fontSize: 14,
    lineHeight: 1.5,
    color: "#333",
  },

  noteBox: {
    background: "#ffffff",
    border: "1px solid #d6dde3",
    borderRadius: 10,
    padding: "12px 14px",
    marginBottom: 18,
  },

  noteTitle: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 6,
  },

  noteText: {
    fontSize: 13,
    color: "#333",
    lineHeight: 1.45,
  },

  label: {
    display: "block",
    marginTop: 14,
    marginBottom: 6,
    fontSize: 14,
    fontWeight: 800,
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

  passwordWrap: {
    position: "relative",
    width: "100%",
  },

  passwordInput: {
    width: "100%",
    padding: 12,
    paddingRight: 72,
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
    border: "1px solid #d6dde3",
    background: "#f7f9fb",
    borderRadius: 8,
    padding: "6px 10px",
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
    color: "#141414",
  },

  error: {
    marginTop: 12,
    padding: "10px 12px",
    backgroundColor: "#fff",
    border: "1px solid #b00020",
    borderRadius: 10,
    color: "#b00020",
    fontSize: 13,
    fontWeight: 700,
  },

  actions: {
    marginTop: 18,
    display: "flex",
    justifyContent: "center",
  },
};