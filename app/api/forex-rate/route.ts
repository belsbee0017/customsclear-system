import { NextRequest, NextResponse } from "next/server";

/**
 * Real-time forex rate endpoint.
 * Uses exchangerate-api.io (free, no key needed) for live USD → PHP rates.
 * Falls back to mock rate if API is unavailable.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { base_currency, quote_currency, rate_date } = body as {
      base_currency?: string;
      quote_currency?: string;
      rate_date?: string;
    };

    const base = base_currency || "USD";
    const quote = quote_currency || "PHP";

    let rate: number | null = null;
    let source = "live";

    // Try exchangerate-api.io (free tier, 1500 requests/month)
    try {
      const apiRes = await fetch(
        `https://api.exchangerate-api.com/v4/latest/${base}`,
        { 
          next: { revalidate: 3600 }, // Cache for 1 hour
          signal: AbortSignal.timeout(5000), // 5 second timeout
        }
      );

      if (apiRes.ok) {
        const data = await apiRes.json();
        rate = data.rates?.[quote];
        
        if (rate && Number.isFinite(rate)) {
          source = "exchangerate-api.io (live)";
        }
      }
    } catch (apiErr) {
      console.warn("Forex API failed:", apiErr);
      // Continue to fallback
    }

    // Fallback: Use realistic rate based on current market (Feb 2026)
    if (!rate || !Number.isFinite(rate)) {
      rate = 58.50; // Realistic USD → PHP rate as of Feb 2026
      source = "fallback (market estimate)";
    }

    return NextResponse.json({
      rate,
      base_currency: base,
      quote_currency: quote,
      rate_date: rate_date || new Date().toISOString().slice(0, 10),
      source,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to get forex rate.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
