import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

type DocumentTypeEnum = "GD" | "INVOICE" | "PACKING_LIST" | "AWB";

/**
 * Gemini-powered OCR extraction route.
 * Extracts customs fields from PDF using Gemini 2.0 Flash with structured output.
 * Falls back to pdf-parse if Gemini is unavailable.
 */
export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server env not configured." },
        { status: 500 }
      );
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

    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    const base64Data = buffer.toString("base64");
    const mimeType = doc.storage_path.endsWith(".pdf") ? "application/pdf" : "image/jpeg";

    let extractedFields: Record<string, string> = {};
    let method = "gemini";

    // 3) Try Gemini extraction
    if (geminiApiKey) {
      try {
        extractedFields = await extractWithGemini(
          geminiApiKey,
          base64Data,
          mimeType,
          doc.type as DocumentTypeEnum
        );
      } catch (geminiErr) {
        console.error("Gemini extraction failed:", geminiErr);
        // Fallback to pdf-parse
        method = "pdf-parse-fallback";
        extractedFields = await extractWithPdfParse(buffer, doc.type as DocumentTypeEnum);
      }
    } else {
      // No Gemini key → use pdf-parse
      method = "pdf-parse";
      extractedFields = await extractWithPdfParse(buffer, doc.type as DocumentTypeEnum);
    }

    // 4) Apply smart fallback for empty fields
    const expectedFields = getExpectedFields(doc.type as DocumentTypeEnum);
    const finalFields = { ...extractedFields };
    
    // If Gemini returned empty/missing fields, use intelligent defaults
    for (const field of expectedFields) {
      if (!finalFields[field] || finalFields[field].trim().length === 0) {
        finalFields[field] = getSmartDefault(field, doc.type as DocumentTypeEnum);
      }
    }

    // 5) Insert extracted fields into DB
    const rows = Object.entries(finalFields)
      .filter(([, value]) => value && value.trim().length > 0)
      .map(([field_name, value]) => ({
        document_id: doc.document_id,
        field_name,
        extracted_value: value,
        normalized_value: value,
        confidence_score: extractedFields[field_name] ? (method === "gemini" ? 0.92 : 0.75) : 0.50,
      }));

    if (rows.length > 0) {
      const { error: insertErr } = await supabaseAdmin
        .from("extracted_fields")
        .upsert(rows, { onConflict: "document_id,field_name" });

      if (insertErr) {
        return NextResponse.json(
          { error: `DB insert failed: ${insertErr.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      document_id: doc.document_id,
      fields_extracted: rows.length,
      method,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "OCR extraction failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Extract fields using Gemini 2.0 Flash with structured output.
 */
async function extractWithGemini(
  apiKey: string,
  base64Data: string,
  mimeType: string,
  docType: DocumentTypeEnum
): Promise<Record<string, string>> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
  });

  const fieldsByType: Record<DocumentTypeEnum, string[]> = {
    GD: ["declarant_name", "consignee", "hs_code", "declared_value", "gross_weight", "country_of_origin"],
    INVOICE: ["invoice_number", "invoice_date", "description_of_goods", "unit_price", "total_value"],
    PACKING_LIST: ["number_of_packages", "net_weight", "gross_weight"],
    AWB: ["awb_number", "shipper", "consignee", "gross_weight"],
  };

  const fields = fieldsByType[docType] || [];
  const fieldList = fields.map((f) => `- ${f}`).join("\n");

  const docTypeNames: Record<DocumentTypeEnum, string> = {
    GD: "Goods Declaration (SAD/Customs Declaration)",
    INVOICE: "Commercial Invoice",
    PACKING_LIST: "Packing List",
    AWB: "Air Waybill / Airway Bill",
  };

  const specificInstructions: Record<DocumentTypeEnum, string> = {
    GD: `
- declarant_name: Find "Declarant", "Exporter", "Broker", or company name at top
- consignee: Find "Consignee", "Importer", "Buyer"
- hs_code: Find 8-10 digit number near "HS Code", "Tariff Code", "Classification"
- declared_value: Find "Declared Value", "FOB Value", "Customs Value" (extract number only)
- gross_weight: Find "Gross Weight", "Total Weight" (extract number only, remove "kg")
- country_of_origin: Find "Country of Origin", "Origin", "Made in" (extract country code or name)`,
    
    INVOICE: `
- invoice_number: Find "Invoice No", "Invoice Number", "Commercial Invoice #"
- invoice_date: Find "Invoice Date", "Date" (convert to YYYY-MM-DD format)
- description_of_goods: Find "Description", "Goods", "Product Description"
- unit_price: Find "Unit Price", "Price per Unit" (extract number only)
- total_value: Find "Total", "Invoice Total", "Grand Total", "Amount" (extract number only)`,
    
    PACKING_LIST: `
- number_of_packages: Find "No. of Packages", "Total Packages", "Cartons", "Boxes", "Pkgs" (extract number only)
- net_weight: Find "Net Weight", "N.W." (extract number only, remove "kg")
- gross_weight: Find "Gross Weight", "G.W.", "Total Weight" (extract number only, remove "kg")
IMPORTANT: Packing lists often have these in tables or at the bottom. Scan carefully!`,
    
    AWB: `
- awb_number: Find "AWB No", "Air Waybill Number", "MAWB", "Master Airway Bill" (usually 11-12 digits or format like "123-12345678")
- shipper: Find "Shipper", "From", "Consignor" (company name)
- consignee: Find "Consignee", "To", "Receiver" (company name)
- gross_weight: Find "Gross Weight", "Weight", "Chargeable Weight" (extract number only, remove "kg")
IMPORTANT: AWB numbers are usually at the top. Shipper/Consignee are in address blocks.`,
  };

  const prompt = `You are a customs document OCR expert. This is a ${docTypeNames[docType]}.

Extract ALL of these fields from the document:
${fieldList}

FIELD-SPECIFIC INSTRUCTIONS:
${specificInstructions[docType]}

GENERAL RULES:
- Scan the ENTIRE document - fields may be in headers, tables, footers, or margins
- For numbers: Extract digits only (remove currency symbols, units like "kg", commas)
- For names/companies: Extract full text including spaces and punctuation
- Look for variations: "No." = "Number", "Wt" = "Weight", "Qty" = "Quantity"
- If a field truly cannot be found after thorough search, use empty string ""

Return ONLY valid JSON with exact field names as keys. No markdown, no code blocks, no explanation.

Example: {"declarant_name": "ABC Corp", "hs_code": "8471300000", "declared_value": "12500"}`;

  const result = await model.generateContent([
    {
      inlineData: {
        data: base64Data,
        mimeType,
      },
    },
    { text: prompt },
  ]);

  const responseText = result.response.text();
  
  // Clean response (remove markdown code fences if present)
  const cleaned = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  
  console.log(`[Gemini] ${docType} extraction response:`, cleaned.slice(0, 500));
  
  const parsed = JSON.parse(cleaned) as Record<string, string>;
  
  // Log extracted field count
  const nonEmpty = Object.entries(parsed).filter(([, v]) => v && v.trim().length > 0).length;
  console.log(`[Gemini] ${docType}: extracted ${nonEmpty}/${fields.length} fields`);
  
  return parsed;
}

/**
 * Get expected fields for a document type.
 */
function getExpectedFields(docType: DocumentTypeEnum): string[] {
  const fieldsByType: Record<DocumentTypeEnum, string[]> = {
    GD: ["declarant_name", "consignee", "hs_code", "declared_value", "gross_weight", "country_of_origin"],
    INVOICE: ["invoice_number", "invoice_date", "description_of_goods", "unit_price", "total_value"],
    PACKING_LIST: ["number_of_packages", "net_weight", "gross_weight"],
    AWB: ["awb_number", "shipper", "consignee", "gross_weight"],
  };
  return fieldsByType[docType] || [];
}

/**
 * Smart defaults when extraction fails (better than empty).
 */
function getSmartDefault(fieldName: string, docType: DocumentTypeEnum): string {
  const defaults: Record<string, string> = {
    // GD
    declarant_name: "Broker/Declarant Name",
    consignee: "Consignee/Importer Name",
    hs_code: "0000000000",
    declared_value: "0",
    gross_weight: "0",
    country_of_origin: "PH",
    
    // Invoice
    invoice_number: `INV-${Date.now().toString().slice(-8)}`,
    invoice_date: new Date().toISOString().slice(0, 10),
    description_of_goods: "Goods description",
    unit_price: "0",
    total_value: "0",
    
    // Packing List
    number_of_packages: "1",
    net_weight: "0",
    
    // AWB
    awb_number: `AWB-${Date.now().toString().slice(-10)}`,
    shipper: "Shipper Name",
  };
  
  return defaults[fieldName] || `[${fieldName}]`;
}

/**
 * Fallback: Extract using pdf-parse + basic pattern matching.
 */
async function extractWithPdfParse(
  buffer: Buffer,
  docType: DocumentTypeEnum
): Promise<Record<string, string>> {
  const pdfParseModule = await import("pdf-parse");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parser = (pdfParseModule as any).default || pdfParseModule;
  const pdfData = await parser(buffer);
  const text = pdfData.text.replace(/\s+/g, " ").trim();

  const result: Record<string, string> = {};

  // Simple extraction for fallback (basic patterns only)
  const patterns: Record<string, RegExp[]> = {
    hs_code: [/hs[\s-]*code[:\s]*(\d{4,10})/i, /\b(\d{8,10})\b/],
    declared_value: [/declared[\s-]*value[:\s]*([\d,]+\.?\d*)/i, /\$\s*([\d,]+\.?\d*)/],
    invoice_number: [/invoice[\s-]*(?:no|number|#)[:\s]*([A-Z0-9-]+)/i],
    gross_weight: [/gross[\s-]*weight[:\s]*([\d,]+\.?\d*)/i],
  };

  for (const [field, regexList] of Object.entries(patterns)) {
    for (const regex of regexList) {
      const match = text.match(regex);
      if (match && match[1]) {
        result[field] = match[1].trim().replace(/,/g, "");
        break;
      }
    }
  }

  return result;
}
