"use client";

import { useState } from "react";
import Button from "@/app/components/Button";

export default function BrokerSignupPage() {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/broker-signup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            email,
            first_name: firstName,
            last_name: lastName,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Registration failed.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Unable to connect to the server.");
    }
  };

  if (submitted) {
    return (
      <main style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Registration Submitted</h1>

          <p style={styles.textItalic}>
            Broker accounts require approval by the system administrator before
            access is granted.
          </p>

          <div style={styles.buttonWrapper}>
            <Button>
              Return to Login
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Broker Account Registration</h1>

        <p style={styles.text}>
          Broker accounts require approval by the system administrator before
          access is granted.
        </p>

        <form onSubmit={handleSubmit}>
          <label style={styles.label}>Email Address</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
          />

          <label style={styles.label}>First Name</label>
          <input
            type="text"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            style={styles.input}
          />

          <label style={styles.label}>Last Name</label>
          <input
            type="text"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            style={styles.input}
          />

          {error && <p style={styles.error}>{error}</p>}

          {/* ✅ GLOBAL BUTTON */}
          <div style={styles.buttonWrapper}>
            <Button type="submit">
              Submit Registration
            </Button>
          </div>
        </form>

        <a href="/login" style={styles.link}>
          Back to Login
        </a>
      </div>
    </main>
  );
}

/* ===============================
   STYLES — UPDATED (UI ONLY)
   =============================== */

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: "calc(100vh - 64px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
    color: "#141414",
  },

  card: {
    width: "100%",
    maxWidth: "420px",
    padding: "28px",
    borderRadius: "10px",
    backgroundColor: "#e8eef3",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },

  title: {
    fontWeight: "bold",
    fontSize: "24px",
    marginBottom: "16px",
  },

  text: {
    fontSize: "16px",
    marginBottom: "24px",
    lineHeight: "1.6",
  },

  textItalic: {
    fontSize: "16px",
    marginBottom: "24px",
    lineHeight: "1.6",
    fontStyle: "italic",
    fontWeight: 400,
  },

  label: {
    display: "block",
    fontSize: "16px",
    marginBottom: "6px",
    marginTop: "16px",
    fontWeight: "bold",
  },

  input: {
    width: "100%",
    padding: "10px 12px",
    fontSize: "16px",
    borderRadius: "6px",
    border: "1px solid #8aa8c2",
    backgroundColor: "#ffffff",
    color: "#141414",
    outline: "none",
  },

  buttonWrapper: {
    marginTop: "22px",
    width: "100%",
    display: "flex",
    justifyContent: "center",
  },

  error: {
    color: "#b00020",
    marginTop: "16px",
    fontSize: "14px",
  },

  link: {
    display: "block",
    marginTop: "24px",
    textAlign: "center",
    color: "#141414",
    textDecoration: "underline",
    fontWeight: "bold",
  },
};
