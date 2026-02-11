"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabaseClient";

/**
 * Officer layout — protects all /officer/* routes client-side.
 * (Server-side protection is handled by middleware.ts)
 */
export default function OfficerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const checkAccess = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        if (alive) router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("users")
        .select("role, status")
        .eq("user_id", session.user.id)
        .single();

      if (!profile || profile.role !== "CUSTOMS_OFFICER" || profile.status !== "ACTIVE") {
        await supabase.auth.signOut();
        if (alive) router.replace("/login");
        return;
      }

      if (alive) setLoading(false);
    };

    checkAccess();
    return () => {
      alive = false;
    };
  }, [router, supabase]);

  if (loading) {
    return (
      <main style={{ padding: 32 }}>
        <p>Checking access…</p>
      </main>
    );
  }

  return <>{children}</>;
}
