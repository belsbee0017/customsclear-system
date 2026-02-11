import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Activity logging endpoint.
 * Records all user actions with Philippine timezone timestamps.
 */
export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server env not configured." }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get user from auth header (optional - some logs are anonymous)
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    let userId: string | null = null;
    if (token) {
      const { data: userData } = await supabaseAdmin.auth.getUser(token);
      userId = userData?.user?.id ?? null;
    }

    const body = await req.json();
    const { action, actor_role, reference_type, reference_id, remarks } = body as {
      action: string;
      actor_role: string;
      reference_type?: string;
      reference_id?: string;
      remarks?: string;
    };

    if (!action || !actor_role) {
      return NextResponse.json(
        { error: "Missing action or actor_role." },
        { status: 400 }
      );
    }

    // Insert log with current timestamp (Supabase will store in UTC, display converts to PH)
    // Don't manually set created_at - let DB default handle it
    const { error: insertErr } = await supabaseAdmin.from("audit_logs").insert({
      action,
      actor_role,
      user_id: userId,
      reference_type: reference_type || null,
      reference_id: reference_id || null,
      remarks: remarks || null,
    });

    if (insertErr) {
      console.error("Activity log insert failed:", insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Logging failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
