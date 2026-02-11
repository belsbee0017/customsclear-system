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
 * Format timestamp for display (Philippine time).
 */
export function formatPhTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}
