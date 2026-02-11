import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    // 1. Create document_set
    const { data: documentSet, error: dsError } = await supabase
      .from("document_sets")
      .insert({
        status: "Pending"
      })
      .select()
      .single();

    if (dsError) throw dsError;

    const documentSetId = documentSet.document_set_id;

    // 2. Upload documents + insert records
    const DOCUMENT_TYPES = ["gd", "invoice", "packing", "awb"];

    for (const type of DOCUMENT_TYPES) {
      const file = formData.get(type) as File | null;
      if (!file) continue;

      const storagePath = '${documentSetId}/${type}_${Date.now()}_${file.name}';

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, file, {
          contentType: file.type
        });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("documents")
        .insert({
          document_set_id: documentSetId,
          type,
          storage_path: storagePath,
          mime_type: file.type,
          ocr_status: "Pending"
        });

      if (insertError) throw insertError;
    }

    return NextResponse.json({
      success: true,
      document_set_id: documentSetId
    });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Submission failed" },
      { status: 500 }
    );
  }
}