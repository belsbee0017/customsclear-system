"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { logActivity } from "@/app/lib/activityLogger";

/**
 * Activity Tracker Component
 * Automatically logs page views and navigation.
 * Add to root layout to track all page visits.
 */
export default function ActivityTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Determine role from pathname
    let role: "BROKER" | "CUSTOMS_OFFICER" | "ADMIN" | "SYSTEM" = "SYSTEM";
    
    if (pathname.startsWith("/broker")) role = "BROKER";
    else if (pathname.startsWith("/officer")) role = "CUSTOMS_OFFICER";
    else if (pathname.startsWith("/admin")) role = "ADMIN";

    // Don't log public pages
    const publicPages = ["/", "/login", "/signup", "/admin-login", "/forgot-password"];
    if (publicPages.includes(pathname)) return;

    // Log page view (don't pass pathname as reference_id - it's UUID only)
    logActivity({
      action: "PAGE_VIEW",
      actor_role: role,
      reference_type: "navigation",
      remarks: `Viewed ${pathname}`,
    });
  }, [pathname]);

  return null; // This component doesn't render anything
}
