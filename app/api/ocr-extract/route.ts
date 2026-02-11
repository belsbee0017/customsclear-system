import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ExtractedField = {
  field_name: string;
  extracted_value: string;
  confidence_score: number;
};

type DocumentTypeEnum = "GD" | "INVOICE" | "PACKING_LIST" | "AWB";

/**
 * Local OCR extraction route (replaces AWS Textract for demo).
 * Extracts text from PDF in Supabase Storage, then pattern-matches fields.
 */
export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server env not configured." },
        { status: 500 }
      );
    }

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

    const body = await req.json();
    const { document_set_id, document_id } = body as {
      document_set_id?: string;
      document_id?: string;
    };

    if (!document_set_id || !document_id) {
      return NextResponse.json(
        { error: "Missing document_set_id or document_id." },
        { status: 400 }
      );
    }

    // 1) Fetch document metadata
    const { data: doc, error: docErr } = await supabaseAdmin
      .from("documents")
      .select("document_id, type, storage_path")
      .eq("document_id", document_id)
      .eq("document_set_id", document_set_id)
      .single();

    if (docErr || !doc || !doc.storage_path) {
      return NextResponse.json(
        { error: "Document not found or has no storage path." },
        { status: 404 }
      );
    }

    // 2) Download PDF from Supabase Storage
    const { data: fileBlob, error: downloadErr } = await supabaseAdmin.storage
      .from("documents")
      .download(doc.storage_path);

    if (downloadErr || !fileBlob) {
      return NextResponse.json(
        { error: "Failed to download document from storage." },
        { status: 500 }
      );
    }

    // 3) Extract text from PDF
    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    
    let rawText = "";
    try {
      // Dynamic import for CJS module
      const pdfParseModule = await import("pdf-parse");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parser = (pdfParseModule as any).default || pdfParseModule;
      const pdfData = await parser(buffer);
      rawText = pdfData.text || "";
    } catch (parseErr) {
      console.error("pdf-parse failed:", parseErr);
      return NextResponse.json(
        { error: "Failed to parse PDF. File may be corrupted or image-based." },
        { status: 500 }
      );
    }

    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json(
        { error: "No text found in PDF. Document may be scanned/image-based." },
        { status: 400 }
      );
    }

    // 4) Pattern-match fields based on document type
    const fields = extractFieldsByType(doc.type as DocumentTypeEnum, rawText);

    // 5) Insert extracted fields into DB
    const rows = fields.map((f) => ({
      document_id: doc.document_id,
      field_name: f.field_name,
      extracted_value: f.extracted_value,
      normalized_value: f.extracted_value,
      confidence_score: f.confidence_score,
    }));

    const { error: insertErr } = await supabaseAdmin
      .from("extracted_fields")
      .upsert(rows, { onConflict: "document_id,field_name" });

    if (insertErr) {
      return NextResponse.json(
        { error: `DB insert failed: ${insertErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      document_id: doc.document_id,
      fields_extracted: fields.length,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "OCR extraction failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Extract fields from raw PDF text based on document type.
 * Enhanced pattern matching with multi-line support, currency handling, and field intelligence.
 */
function extractFieldsByType(
  docType: DocumentTypeEnum,
  rawText: string
): ExtractedField[] {
  const fields: ExtractedField[] = [];
  
  // Normalize text: preserve line breaks for context, collapse multiple spaces
  const text = rawText.replace(/[ \t]+/g, " ").trim();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  switch (docType) {
    case "GD": {
      // Goods Declaration / SAD
      fields.push(
        extractField("declarant_name", text, lines, [
          /declarant[:\s]+([A-Z][A-Za-z\s&.,'-]{3,60})/i,
          /exporter[:\s]+([A-Z][A-Za-z\s&.,'-]{3,60})/i,
          /broker[:\s]+([A-Z][A-Za-z\s&.,'-]{3,60})/i,
        ]),
        extractField("consignee", text, lines, [
          /consignee[:\s]+([A-Z][A-Za-z\s&.,'-]{3,60})/i,
          /importer[:\s]+([A-Z][A-Za-z\s&.,'-]{3,60})/i,
          /buyer[:\s]+([A-Z][A-Za-z\s&.,'-]{3,60})/i,
        ]),
        extractField("hs_code", text, lines, [
          /hs[\s-]*code[:\s]*(\d{4,10})/i,
          /tariff[\s-]*code[:\s]*(\d{4,10})/i,
          /classification[:\s]*(\d{4,10})/i,
          /\b(\d{8,10})\b(?!\d)/,
        ]),
        extractField("declared_value", text, lines, [
          /declared[\s-]*value[:\s]*(USD|PHP|EUR)?\s*([\d,]+\.?\d*)/i,
          /customs[\s-]*value[:\s]*(USD|PHP|EUR)?\s*([\d,]+\.?\d*)/i,
          /fob[\s-]*value[:\s]*(USD|PHP|EUR)?\s*([\d,]+\.?\d*)/i,
          /total[\s-]*value[:\s]*(USD|PHP|EUR)?\s*([\d,]+\.?\d*)/i,
        ], true),
        extractField("gross_weight", text, lines, [
          /gross[\s-]*weight[:\s]*([\d,]+\.?\d*)\s*(?:kg|kgs|kilos)?/i,
          /total[\s-]*weight[:\s]*([\d,]+\.?\d*)\s*(?:kg|kgs)?/i,
        ]),
        extractField("country_of_origin", text, lines, [
          /country[\s-]*of[\s-]*origin[:\s]+([A-Z]{2,3}|[A-Z][a-z]{2,20})/i,
          /origin[:\s]+([A-Z]{2,3}|[A-Z][a-z]{2,20})/i,
          /made[\s-]*in[:\s]+([A-Z]{2,3}|[A-Z][a-z]{2,20})/i,
        ])
      );
      break;
    }

    case "INVOICE": {
      fields.push(
        extractField("invoice_number", text, lines, [
          /invoice[\s-]*(?:no|number|#)[:\s]*([A-Z0-9-]{3,30})/i,
          /\b(INV[A-Z0-9-]{3,20})\b/i,
          /commercial[\s-]*invoice[:\s]*([A-Z0-9-]{3,30})/i,
        ]),
        extractField("invoice_date", text, lines, [
          /invoice[\s-]*date[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
          /date[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
          /(\d{4}-\d{2}-\d{2})/,
        ]),
        extractField("description_of_goods", text, lines, [
          /description[:\s]+([A-Za-z0-9\s,.\-()]{10,150})/i,
          /goods[:\s]+([A-Za-z0-9\s,.\-()]{10,150})/i,
          /product[:\s]+([A-Za-z0-9\s,.\-()]{10,150})/i,
        ]),
        extractField("unit_price", text, lines, [
          /unit[\s-]*price[:\s]*(USD|PHP|EUR)?\s*([\d,]+\.?\d*)/i,
          /price[\s-]*per[\s-]*unit[:\s]*(USD|PHP|EUR)?\s*([\d,]+\.?\d*)/i,
        ], true),
        extractField("total_value", text, lines, [
          /total[\s-]*(?:amount|value)[:\s]*(USD|PHP|EUR)?\s*([\d,]+\.?\d*)/i,
          /invoice[\s-]*total[:\s]*(USD|PHP|EUR)?\s*([\d,]+\.?\d*)/i,
          /grand[\s-]*total[:\s]*(USD|PHP|EUR)?\s*([\d,]+\.?\d*)/i,
        ], true)
      );
      break;
    }

    case "PACKING_LIST": {
      fields.push(
        extractField("number_of_packages", text, lines, [
          /(?:no\.|number)[\s-]*of[\s-]*packages[:\s]*(\d+)/i,
          /total[\s-]*packages[:\s]*(\d+)/i,
          /packages[:\s]*(\d+)/i,
          /cartons[:\s]*(\d+)/i,
        ]),
        extractField("net_weight", text, lines, [
          /net[\s-]*weight[:\s]*([\d,]+\.?\d*)\s*(?:kg|kgs)?/i,
        ]),
        extractField("gross_weight", text, lines, [
          /gross[\s-]*weight[:\s]*([\d,]+\.?\d*)\s*(?:kg|kgs)?/i,
          /total[\s-]*weight[:\s]*([\d,]+\.?\d*)\s*(?:kg|kgs)?/i,
        ])
      );
      break;
    }

    case "AWB": {
      fields.push(
        extractField("awb_number", text, lines, [
          /awb[\s-]*(?:no|number|#)?[:\s]*([A-Z0-9-]{5,30})/i,
          /air[\s-]*waybill[:\s]*([A-Z0-9-]{5,30})/i,
          /waybill[:\s]*([A-Z0-9-]{5,30})/i,
        ]),
        extractField("shipper", text, lines, [
          /shipper[:\s]+([A-Z][A-Za-z\s&.,'-]{3,60})/i,
          /from[:\s]+([A-Z][A-Za-z\s&.,'-]{3,60})/i,
        ]),
        extractField("consignee", text, lines, [
          /consignee[:\s]+([A-Z][A-Za-z\s&.,'-]{3,60})/i,
          /to[:\s]+([A-Z][A-Za-z\s&.,'-]{3,60})/i,
        ]),
        extractField("gross_weight", text, lines, [
          /gross[\s-]*weight[:\s]*([\d,]+\.?\d*)\s*(?:kg|kgs)?/i,
          /weight[:\s]*([\d,]+\.?\d*)\s*(?:kg|kgs)?/i,
        ])
      );
      break;
    }
  }

  return fields.filter((f) => f.extracted_value.length > 0);
}

/**
 * Extract a single field using multiple patterns.
 * @param fieldName - Field name for DB
 * @param text - Full normalized text
 * @param lines - Array of lines for context-aware matching
 * @param patterns - Regex patterns to try
 * @param hasCurrency - If true, pattern has currency prefix (extract group 2)
 */
function extractField(
  fieldName: string,
  text: string,
  lines: string[],
  patterns: RegExp[],
  hasCurrency = false
): ExtractedField {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const captureIndex = hasCurrency && match[2] ? 2 : 1;
      const rawValue = match[captureIndex];
      
      if (rawValue) {
        const value = rawValue.trim().replace(/,/g, "");
        return {
          field_name: fieldName,
          extracted_value: value,
          confidence_score: 0.88,
        };
      }
    }
  }

  // Fallback: line-by-line search for field name proximity
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    const fieldKey = fieldName.replace(/_/g, " ");
    
    if (lowerLine.includes(fieldKey)) {
      // Extract value after colon or space
      const parts = line.split(/[:=]/);
      if (parts.length > 1) {
        const candidate = parts[1].trim().split(/\s+/)[0];
        if (candidate && candidate.length > 0 && candidate.length < 100) {
          return {
            field_name: fieldName,
            extracted_value: candidate.replace(/,/g, ""),
            confidence_score: 0.65,
          };
        }
      }
    }
  }

  return {
    field_name: fieldName,
    extracted_value: "",
    confidence_score: 0,
  };
}
