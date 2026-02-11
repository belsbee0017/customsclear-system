import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Officer action endpoint (replaces officer-action Edge Function).
 * Handles: SEND_BACK, REJECT, PROCEED actions on document sets.
 */
export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server env not configured." }, { status: 500 });
    }

    // Auth check
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return NextResponse.json({ error: "Missing auth token." }, { status: 401 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData.user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    // Verify officer role
    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("user_id", userData.user.id)
      .single();

    if (!profile || profile.role !== "CUSTOMS_OFFICER") {
      return NextResponse.json({ error: "Only customs officers can perform this action." }, { status: 403 });
    }

    const body = await req.json();
    const { document_set_id, action, remarks } = body as {
      document_set_id?: string;
      action?: "SEND_BACK" | "REJECT" | "PROCEED";
      remarks?: string;
    };

    if (!document_set_id || !action) {
      return NextResponse.json({ error: "Missing document_set_id or action." }, { status: 400 });
    }

    // Map actions to status (match exact enum values in DB: doc_status)
    const statusMap: Record<string, string> = {
      SEND_BACK: "For_Review", // Send back to broker for corrections
      REJECT: "Error", // Use "Error" for rejection (Rejected doesn't exist in enum)
      PROCEED: "Validated",
    };

    const newStatus = statusMap[action];
    if (!newStatus) {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    // Update document_set status
    const updatePayload: Record<string, unknown> = { status: newStatus };
    // Note: officer_remarks column doesn't exist in document_sets yet
    // Remarks are stored in audit_logs instead

    const { error: updateErr } = await supabaseAdmin
      .from("document_sets")
      .update(updatePayload)
      .eq("document_set_id", document_set_id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Log action in audit_logs (DB stores UTC, display converts to PH)
    await supabaseAdmin.from("audit_logs").insert({
      action: `OFFICER_${action}`,
      reference_type: "document_set",
      reference_id: document_set_id,
      actor_role: "CUSTOMS_OFFICER",
      user_id: userData.user.id,
      remarks: remarks || null,
    });

    return NextResponse.json({
      success: true,
      document_set_id,
      new_status: newStatus,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Officer action failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
