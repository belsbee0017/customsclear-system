"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/app/lib/supabaseClient";
import Button from "@/app/components/Button";
import ChangePasswordModal from "@/app/components/ChangePasswordModal";

export default function BrokerAccountPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Not authenticated.");
        setLoading(false);
        return;
      }

      const authUserId = session.user.id;

      const { data, error } = await supabase
        .from("users")
        .select("first_name, last_name, email, role, status, created_at")
        .eq("user_id", authUserId)
        .single();

      if (error || !data) {
        setError("Account not found.");
        setLoading(false);
        return;
      }

      setProfile(data);
      setLoading(false);
    };

    loadProfile();
  }, []);

  if (loading) {
    return <main style={styles.container}>Loading account…</main>;
  }

  if (error) {
    return (
      <main style={styles.container}>
        <p>{error}</p>
      </main>
    );
  }

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Account Information</h1>

        <div style={styles.row}>
          <strong>Name:</strong> {profile.first_name} {profile.last_name}
        </div>

        <div style={styles.row}>
          <strong>Email:</strong> {profile.email}
        </div>

        <div style={styles.row}>
          <strong>Role:</strong> {profile.role}
        </div>

        <div style={styles.row}>
          <strong>Status:</strong> {profile.status}
        </div>

        <div style={styles.row}>
          <strong>Created:</strong>{" "}
          {new Date(profile.created_at).toLocaleDateString()}
        </div>

        <div style={{ marginTop: "24px" }}>
          <Button variant="outline"
            onClick={() => setShowChangePassword(true)}
            > Change Password
          </Button>
        </div>
      </div>
  
      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </main>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    padding: "32px",
    backgroundColor: "#ffffff",
    minHeight: "calc(100vh - 64px)",
    color: "#141414"
  },
  card: {
    backgroundColor: "#e8eef3",
    borderRadius: "12px",
    padding: "32px",
    maxWidth: "800px",
    margin: "0 auto"
  },
  title: {
    fontSize: "26px",
    fontWeight: "bold",
    marginBottom: "20px"
  },
  row: {
    marginBottom: "12px",
    fontSize: "16px"
  }
};