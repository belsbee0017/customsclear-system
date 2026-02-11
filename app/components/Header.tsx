"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/app/lib/supabaseClient";

/* ===============================
   ROLE RESOLVER (PATH-BASED)
   =============================== */
function useUserRole(): "PUBLIC" | "BROKER" | "OFFICER" | "ADMIN" {
  const pathname = usePathname();

  if (pathname == "/admin-login") return "PUBLIC";
  if (pathname == "/admin/login") return "PUBLIC";

  if (pathname.startsWith("/admin")) return "ADMIN";
  if (pathname.startsWith("/officer")) return "OFFICER";
  if (pathname.startsWith("/broker")) return "BROKER";

  return "PUBLIC";
}

/* ===============================
   NAV LINK WITH FEEDBACK
   =============================== */
function NavLink({
  href,
  children
}: {
  href: string;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <Link
      href={href}
      style={{
        ...styles.link,
        backgroundColor: hovered ? "#dbe5ee" : "transparent",
        boxShadow: hovered ? "0 2px 6px rgba(0,0,0,0.12)" : "none",
        transform: pressed ? "scale(0.95)" : "scale(1)"
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
    >
      {children}
    </Link>
  );
}

export default function Header() {
  const role = useUserRole();
  const router = useRouter();
  const supabase = createClient();
  const pathname = usePathname();
  const hideNav = pathname === "/admin-login" || pathname === "/admin/login";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <header style={styles.header}>
      <div style={styles.inner}>
        {/* LOGO */}
        <div style={styles.logoWrapper}>
          <div style={styles.logoText}>
            <span style={styles.logoBold}>Customs</span>
            <span style={styles.logoNormal}>Clear</span>
          </div>
          <div style={styles.tagline}>
            CLEAR CUSTOMS, CLEAR FUTURE
          </div>
        </div>

        {/* NAVIGATION */}
        {!hideNav && (
        <nav style={styles.nav}>
          {role === "PUBLIC" && (
            <>
              <NavLink href="/login">Login</NavLink>
              <NavLink href="/signup">Register</NavLink>
            </>
          )}

          {role === "BROKER" && (
            <>
              <NavLink href="/broker">Home</NavLink>
              <NavLink href="/broker/account">Account</NavLink>
              <span onClick={handleLogout} style={styles.link}>
                Logout
              </span>
            </>
          )}

          {role === "OFFICER" && (
            <>
              <NavLink href="/officer/home">Home</NavLink>
              <NavLink href="/officer/account">Account</NavLink>
              <span onClick={handleLogout} style={styles.link}>
                Logout
              </span>
            </>
          )}

          {role === "ADMIN" && (
            <>
              <NavLink href="/admin/broker-approval">
                Broker Approval
              </NavLink>
              <NavLink href="/admin/activity-logs">
                Activity Logs
              </NavLink>
              <span onClick={handleLogout} style={styles.link}>
                Logout
              </span>
            </>
          )}
        </nav>
        )}
      </div>
    </header>
  );
}

/* ===============================
   STRICT BRAND KIT STYLES
   =============================== */

const styles: { [key: string]: React.CSSProperties } = {
  header: {
    width: "100%",
    backgroundColor: "#e8eef3",
    borderBottom: "1px solid #d6dde3"
  },
  inner: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "10px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: "64px"
  },
  logoWrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px"
  },
  logoText: {
    fontSize: "22px",
    color: "#141414",
    lineHeight: 1,
    letterSpacing: "1.5px"
  },
  logoBold: { fontWeight: "700" },
  logoNormal: { fontWeight: "400" },
  tagline: {
    fontSize: "11px",
    fontWeight: "700",
    backgroundColor: "#8aa8c2",
    color: "#141414",
    padding: "4px 8px",
    borderRadius: "6px",
    letterSpacing: "0.5px"
  },
  nav: {
    display: "flex",
    gap: "24px"
  },
  link: {
    fontSize: "16px",
    fontWeight: "bold",
    color: "#141414",
    textDecoration: "none",
    cursor: "pointer",
    padding: "6px 8px",
    borderRadius: "6px",
    transition: "all 0.15s ease"
  }
};
