"use client";

import { useEffect } from "react";
import { createClient } from "@/app/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";

export default function OfficerHomePage() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAccess = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      // 🔐 Role guard (OFFICER ONLY)
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      if (!profile || profile.role !== "CUSTOMS_OFFICER") {
        router.replace("/login");
        return;
      }
    };

    checkAccess();
  }, [router]);

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Formal Entry Unit</h1>
        <p style={styles.subtitle}>
          Welcome to the CustomsClear system. Select a task below to begin
          processing formal entries.
        </p>

        <div style={styles.grid}>
          {/* Submitted Entries */}
          <section style={styles.tile}>
            <h2 style={styles.tileTitle}>Submitted Formal Entries</h2>
            <p style={styles.tileText}>
              View and validate formal entry documents submitted to the system.
            </p>
            <Button onClick={() => router.push("/officer/submitted-entries")}>
              View Entries
            </Button>
          </section>

          {/* Validated */}
          <section style={styles.tile}>
            <h2 style={styles.tileTitle}>Validated Entries</h2>
            <p style={styles.tileText}>
              Access formal entries that have been successfully validated.
            </p>
            <Button onClick={() => router.push("/officer/past-entries")}>
              View Accomplished Entries
            </Button>
          </section>
        </div>
      </div>
    </main>
  );
}

/* ===============================
   STYLES — STRICT BRAND KIT
   =============================== */

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    padding: "32px",
    backgroundColor: "#ffffff",
    color: "#141414",
    minHeight: "calc(100vh - 64px)"
  },

  card: {
    backgroundColor: "#e8eef3",
    padding: "32px",
    borderRadius: "12px",
    maxWidth: "1100px",
    margin: "0 auto",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
  },

  title: {
    fontSize: "28px",
    fontWeight: "bold",
    marginBottom: "8px"
  },

  subtitle: {
    fontSize: "16px",
    marginBottom: "32px"
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "24px"
  },

  tile: {
    backgroundColor: "#ffffff",
    borderRadius: "10px",
    padding: "24px",
    border: "1px solid #d6dde3",
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },

  tileTitle: {
    fontSize: "18px",
    fontWeight: "bold"
  },

  tileText: {
    fontSize: "14px",
    flexGrow: 1
  }
};