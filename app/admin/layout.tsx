"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabaseClient";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const protectRoute = async () => {
      // 1) Check session
      const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) {
        await supabase.auth.signOut();
        if (alive) router.replace("/admin-login");
        return;
      }

      const session = sessionData.session;
      if (!session) {
        if (alive) router.replace("/admin-login");
        return;
      }

      // 2) Fetch user profile
      const authUserId = session.user.id;

      const { data: user, error } = await supabase
        .from("users")
        .select("role, status")
        .eq("user_id", authUserId)
        .single();

      if (error || !user) {
        await supabase.auth.signOut();
        if (alive) router.replace("/admin-login");
        return;
      }

      // 3) Enforce ADMIN + ACTIVE
      const roleOk = user.role === "ADMIN";
      const statusOk = String(user.status ?? "").toUpperCase() === "ACTIVE";

      if (!roleOk || !statusOk) {
        await supabase.auth.signOut();
        if (alive) router.replace("/admin-login");
        return;
      }

      if (alive) setLoading(false);
    };

    protectRoute();

    return () => {
      alive = false;
    };
  }, [router, supabase]);

  if (loading) {
    return (
      <main style={{ padding: "32px" }}>
        <p>Checking permissions…</p>
      </main>
    );
  }

  return <>{children}</>;
}