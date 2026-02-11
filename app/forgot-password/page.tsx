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

  const sendReset = async () => {
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
    <main style={{ padding: 32, maxWidth: 420, margin: "0 auto" }}>
      <h1>Forgot Password</h1>

      {sent ? (
        <p style={{ fontSize: 14 }}>
          If an account exists for <strong>{email}</strong>, a password reset
          link has been sent.
        </p>
      ) : (
        <>
          <label style={{ fontWeight: 700, fontSize: 14 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 8,
              border: "1px solid #8aa8c2",
              marginTop: 8,
            }}
            required
          />

          {error && <p style={{ color: "#b00020", marginTop: 12 }}>{error}</p>}

          <div style={{ marginTop: 18 }}>
            <Button onClick={sendReset} disabled={loading}>
              {loading ? "Sending…" : "Send Reset Link"}
            </Button>
          </div>
        </>
      )}
    </main>
  );
}