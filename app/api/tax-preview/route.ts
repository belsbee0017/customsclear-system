import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Tax computation preview endpoint (replaces compute-tax-preview Edge Function).
 * Computes duty, VAT, and total tax based on extracted fields.
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

    const body = await req.json();
    const { document_set_id, exchange_rate, base_currency, quote_currency } = body as {
      document_set_id?: string;
      exchange_rate?: number;
      base_currency?: string;
      quote_currency?: string;
    };

    if (!document_set_id) {
      return NextResponse.json({ error: "Missing document_set_id." }, { status: 400 });
    }

    // Fetch extracted fields for this document set
    const { data: docs } = await supabaseAdmin
      .from("documents")
      .select("document_id")
      .eq("document_set_id", document_set_id);

    if (!docs || docs.length === 0) {
      return NextResponse.json({ error: "No documents found." }, { status: 404 });
    }

    const docIds = docs.map((d) => d.document_id);

    const { data: fields } = await supabaseAdmin
      .from("extracted_fields")
      .select("field_name, normalized_value")
      .in("document_id", docIds);

    // Extract relevant fields
    const fieldMap: Record<string, string> = {};
    (fields || []).forEach((f) => {
      fieldMap[f.field_name] = f.normalized_value || "";
    });

    // Extract values from extracted fields
    const declaredValue = parseFloat(fieldMap.declared_value || fieldMap.total_value || "0");
    const rate = exchange_rate || 58.50;
    const hsCode = fieldMap.hs_code || "";

    // PHILIPPINE CUSTOMS TAX COMPUTATION (BOC Formula)
    // Example: $1,520 FOB × ₱56.00 = ₱85,120.00
    // Step 1: Dutiable Value (PHP) = FOB/CIF (USD) × Exchange Rate
    const dutiableValuePHP = declaredValue * rate;
    
    // Step 2: Customs Duty = Dutiable Value × Duty Rate
    // Electronics (HS 8471*): 0%, Vehicles (87*): 5%, Others: 3%
    let dutyRate = 0.00;
    if (hsCode.startsWith("8471") || hsCode.startsWith("8473")) {
      dutyRate = 0.00;
    } else if (hsCode.startsWith("87")) {
      dutyRate = 0.05;
    } else if (hsCode.length >= 4) {
      dutyRate = 0.03;
    }
    
    const dutyAmount = dutiableValuePHP * dutyRate;
    
    // Step 3: VAT Base = Dutiable Value + Duty
    const vatBase = dutiableValuePHP + dutyAmount;
    
    // Step 4: VAT (12%) = VAT Base × 0.12
    const vatRate = 0.12;
    const vatAmount = vatBase * vatRate;
    
    // Step 5: Total Payable = Duty + VAT
    const totalTax = dutyAmount + vatAmount;

    const rows = [
      {
        line_no: 1,
        description: fieldMap.description_of_goods || "Imported goods",
        hs_code: hsCode || "0000000000",
        currency: base_currency || "USD",
        declared_value: declaredValue,
        exchange_rate: rate,
        declared_value_php: dutiableValuePHP,
        duty_rate: dutyRate,
        duty_amount: dutyAmount,
        vat_rate: vatRate,
        vat_amount: vatAmount,
        total_tax: totalTax,
      },
    ];

    return NextResponse.json({
      rows,
      summary: {
        total_duty: dutyAmount,
        total_vat: vatAmount,
        total_tax: totalTax,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Tax computation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
