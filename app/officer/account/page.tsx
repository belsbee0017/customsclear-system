"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/app/lib/supabaseClient";
import Button from "@/app/components/Button";
import { useRouter } from "next/navigation";
import ChangePasswordModal from "@/app/components/ChangePasswordModal";


type UserProfile = {
  user_id: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  email: string;
  role: string;
  unit?: string | null;
  status: string;
  mobile_number?: string | null;
};

export default function OfficerAccountPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const supabase = createClient();


  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

        const { data } = await supabase
    .from("users")
   .select(`
    user_id,
    email,
    first_name,
    last_name,
    role,
    status,
    mobile_number
    `)

    .eq("user_id", session.user.id)
    .single();

      if (data) setProfile(data);
      setLoading(false);
    };

    loadProfile();
  }, [router]);

  if (loading) {
    return <main style={{ padding: "32px" }}>Loading account…</main>;
  }

  if (!profile) {
    return <main style={{ padding: "32px" }}>Account not found.</main>;
  }

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>My Account</h1>

        {/* Identity */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Account Information</h2>

          <div style={styles.grid}>
            <Field label="User ID" value={profile.user_id} mono />
            <Field label="First Name" value={profile.first_name} />
            <Field label="Middle Name" value={profile.middle_name ?? "—"} />
            <Field label="Last Name" value={profile.last_name} />
            <Field label="Email Address" value={profile.email} />
            <Field label="Role" value={profile.role} />
            <Field label="Unit / Access" value={profile.unit ?? "—"} />
            <Field label="Account Status" value={profile.status} />
            <Field
              label="Mobile Number"
              value={profile.mobile_number ?? "—"}
            />
          </div>
        </section>

        {/* Actions */}
        <div style={styles.actions}>
          <Button onClick={() => setShowPasswordModal(true)}>
            Change Password
            </Button>
        </div>
      </div>

    {showPasswordModal && (
    <ChangePasswordModal
    onClose={() => setShowPasswordModal(false)}/>
)}

    </main>
  );
}

/* ---------- Reusable Field ---------- */

function Field({
  label,
  value,
  mono = false
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <div
        style={{
          ...styles.value,
          fontFamily: mono ? "monospace" : "inherit"
        }}
      >
        {value}
      </div>
    </div>
  );
}

/* ---------- Styles ---------- */

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
    maxWidth: "1000px",
    margin: "0 auto",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
  },

  title: {
    fontSize: "28px",
    fontWeight: "bold",
    marginBottom: "24px"
  },

  section: {
    marginBottom: "32px"
  },

  sectionTitle: {
    fontSize: "18px",
    fontWeight: "bold",
    marginBottom: "16px"
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "16px"
  },

  field: {
    display: "flex",
    flexDirection: "column",
    gap: "6px"
  },

  label: {
    fontSize: "13px",
    fontWeight: "bold"
  },

  value: {
    padding: "10px 12px",
    backgroundColor: "#ffffff",
    borderRadius: "6px",
    border: "1px solid #d6dde3",
    fontSize: "14px"
  },

  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px"
  }
};
