/**
 * Activity Logger Utility
 * Logs all user actions to audit_logs table with Philippine timezone.
 */

export type ActivityAction =
  | "PAGE_VIEW"
  | "DOCUMENT_UPLOAD"
  | "DOCUMENT_SAVE"
  | "FIELD_EDIT"
  | "OCR_RUN"
  | "SUBMISSION_VIEW"
  | "OFFICER_VIEW_ENTRY"
  | "OFFICER_COMPUTE_TAX"
  | "OFFICER_SEND_BACK"
  | "OFFICER_REJECT"
  | "OFFICER_PROCEED"
  | "ADMIN_APPROVE_BROKER"
  | "ADMIN_REJECT_BROKER"
  | "NAVIGATION"
  | "BUTTON_CLICK";

export type ActivityLog = {
  action: ActivityAction;
  actor_role: "BROKER" | "CUSTOMS_OFFICER" | "ADMIN" | "SYSTEM";
  reference_type?: string;
  reference_id?: string;
  remarks?: string;
};

/**
 * Log activity to the backend API.
 * Automatically includes user_id from session and PH timestamp.
 */
export async function logActivity(log: ActivityLog): Promise<void> {
  try {
    await fetch("/api/log-activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(log),
      // Don't block UI if logging fails
      keepalive: true,
    });
  } catch {
    // Silent fail - logging should never break the app
  }
}

/**
 * Get current Philippine time as ISO string.
 */
export function getPhilippineTime(): string {
  return new Date().toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * Parse a Supabase/Postgres timestamp string as UTC.
 *
 * Supabase may omit the timezone indicator (e.g. "2026-03-03T02:31:00").
 * Without a suffix, browsers in UTC+8 (Philippines) treat that string as
 * LOCAL time, shifting the epoch by -8 h before any offset math runs.
 * Appending "Z" forces unambiguous UTC parsing.
 *
 * Safe when the string already carries a suffix (+00:00, +08:00, Z, etc.).
 */
export function parseUtcDate(dateStr: string): Date {
  const s = dateStr.trim().replace(" ", "T");
  const withZone = /Z$|[+-]\d{2}:?\d{2}$/.test(s) ? s : s + "Z";
  return new Date(withZone);
}

/**
 * Format timestamp in Philippine Time (UTC+8).
 * Manually shifts the UTC timestamp by +8 hours — no reliance on
 * Intl.DateTimeFormat, toLocaleString, or OS timezone databases,
 * so it is always accurate regardless of environment.
 *
 * Output: MM/DD/YYYY, HH:MM:SS AM/PM  (e.g. 3/3/2026, 10:26:53 AM)
 */
export function formatPhTime(dateStr: string): string {
  if (!dateStr) return dateStr;

  const utc = parseUtcDate(dateStr);
  if (isNaN(utc.getTime())) return dateStr;

  // Shift UTC → UTC+8
  const ph = new Date(utc.getTime() + 8 * 60 * 60 * 1000);

  const month  = ph.getUTCMonth() + 1;
  const day    = ph.getUTCDate();
  const year   = ph.getUTCFullYear();
  const h24    = ph.getUTCHours();
  const min    = ph.getUTCMinutes();
  const sec    = ph.getUTCSeconds();

  const h12  = h24 % 12 || 12;
  const ampm = h24 < 12 ? "AM" : "PM";
  const pad  = (n: number) => String(n).padStart(2, "0");

  return `${month}/${day}/${year}, ${pad(h12)}:${pad(min)}:${pad(sec)} ${ampm}`;
}
