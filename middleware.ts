import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware runs on EVERY matched request.
 * 1. Refreshes the Supabase auth token (critical for Vercel deployment)
 * 2. Protects /broker/*, /officer/*, /admin/* routes
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If env vars are missing, skip auth checks (should not happen in production)
  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do NOT use getSession() here — getUser() validates the JWT server-side
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  /* ── Public routes: no auth needed ── */
  const publicPaths = [
    "/",
    "/login",
    "/signup",
    "/admin-login",
    "/forgot-password",
    "/auth/confirm-account",
    "/auth/reset-password",
  ];

  const isPublic =
    publicPaths.includes(pathname) ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.includes(".");

  if (isPublic) {
    return supabaseResponse;
  }

  /* ── Protected routes: redirect to login if no user ── */
  if (!user) {
    const loginUrl = pathname.startsWith("/admin")
      ? new URL("/admin-login", request.url)
      : new URL("/login", request.url);

    return NextResponse.redirect(loginUrl);
  }

  /* ── Role-based protection ── */
  // Fetch user profile to check role (only for protected routes)
  const { data: profile } = await supabase
    .from("users")
    .select("role, status")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.status !== "ACTIVE") {
    // Inactive or missing profile → sign out and redirect
    const loginUrl = pathname.startsWith("/admin")
      ? new URL("/admin-login", request.url)
      : new URL("/login", request.url);

    return NextResponse.redirect(loginUrl);
  }

  // Enforce role boundaries
  if (pathname.startsWith("/broker") && profile.role !== "BROKER") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname.startsWith("/officer") && profile.role !== "CUSTOMS_OFFICER") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname.startsWith("/admin") && profile.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/admin-login", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files and images.
     * See: https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
