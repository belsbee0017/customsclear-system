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
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      setReady(!!data.session);
    };
    check();
  }, [supabase]);

  const update = async () => {
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

  if (!ready) {
    return (
      <main style={{ padding: 32, maxWidth: 520, margin: "0 auto" }}>
        <h1>Reset Password</h1>
        <p style={{ fontSize: 13 }}>
          Invalid or expired reset link. Please request a new one.
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: 32, maxWidth: 520, margin: "0 auto" }}>
      <h1>Reset Password</h1>

      <label style={{ fontWeight: 700 }}>New Password</label>
      <div style={{ position: "relative" }}>
        <input
          type={show ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 8,
            border: "1px solid #8aa8c2",
            marginTop: 8,
          }}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          style={{
            position: "absolute",
            right: 10,
            top: 18,
            border: "none",
            background: "transparent",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>

      <label style={{ fontWeight: 700, marginTop: 14, display: "block" }}>
        Confirm Password
      </label>
      <input
        type={show ? "text" : "password"}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        style={{
          width: "100%",
          padding: 12,
          borderRadius: 8,
          border: "1px solid #8aa8c2",
          marginTop: 8,
        }}
      />

      {error && <p style={{ color: "#b00020", marginTop: 12 }}>{error}</p>}

      <div style={{ marginTop: 18 }}>
        <Button onClick={update} disabled={loading}>
          {loading ? "Updating…" : "Update Password"}
        </Button>
      </div>
    </main>
  );
}