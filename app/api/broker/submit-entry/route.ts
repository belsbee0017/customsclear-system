import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* DB enum map (upload keys → DB enum) */
const DOCUMENT_TYPE_MAP: Record<string, string> = {
  gd: "GD",
  invoice: "INVOICE",
  packing: "PACKING_LIST",
  awb: "AWB",
};

export async function POST(req: Request) {
  try {
    // Create client inside handler (env vars not available at build time)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const formData = await req.formData();

    /* ── Resolve user from Authorization header ── */
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    let userId: string | null = null;

    if (token) {
      const { data: userData } = await supabaseAdmin.auth.getUser(token);
      userId = userData?.user?.id ?? null;
    }

    /* 1. Create document_set (with created_by if available) */
    const insertPayload: Record<string, unknown> = { status: "Pending" };
    if (userId) insertPayload.created_by = userId;

    const { data: documentSet, error: dsError } = await supabaseAdmin
      .from("document_sets")
      .insert(insertPayload)
      .select()
      .single();

    if (dsError) throw dsError;

    const documentSetId = documentSet.document_set_id;

    /* 2. Upload documents + insert records */
    const DOCUMENT_TYPES = ["gd", "invoice", "packing", "awb"];

    for (const type of DOCUMENT_TYPES) {
      const file = formData.get(type) as File | null;
      if (!file) continue;

      // FIX: was single-quoted string — variables were NOT interpolated
      const storagePath = `${documentSetId}/${type}_${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("documents")
        .upload(storagePath, file, {
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabaseAdmin
        .from("documents")
        .insert({
          document_set_id: documentSetId,
          type: DOCUMENT_TYPE_MAP[type] ?? type.toUpperCase(),
          storage_path: storagePath,
          mime_type: file.type,
          ocr_status: "Pending",
        });

      if (insertError) throw insertError;
    }

    return NextResponse.json({
      success: true,
      document_set_id: documentSetId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Submission failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}