/**
 * Seed Broker, Customs Officer, and Admin accounts into Supabase.
 *
 * Prerequisites:
 * - .env or .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *
 * Run: npm run seed   (loads ENV first, then runs this script)
 *
 * Default passwords are set below; change them after first login or in production.
 */

// ENV FIRST — load before any other requires
require("./load-env.js");

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env / .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Seed accounts.
 * role: BROKER | CUSTOMS_OFFICER | ADMIN
 * status: ACTIVE so they can log in immediately.
 */
const SEED_ACCOUNTS = [
  {
    email: "admin@customsclear.local",
    password: "AdminSeed2025!",
    first_name: "System",
    last_name: "Admin",
    role: "ADMIN",
  },
  {
    email: "broker@customsclear.local",
    password: "BrokerSeed2025!",
    first_name: "Juan",
    last_name: "Broker",
    role: "BROKER",
  },
  {
    email: "officer@customsclear.local",
    password: "OfficerSeed2025!",
    first_name: "Maria",
    last_name: "Officer",
    role: "CUSTOMS_OFFICER",
  },
];

async function seed() {
  console.log("Seeding accounts into Supabase...\n");

  for (const account of SEED_ACCOUNTS) {
    const { email, password, first_name, last_name, role } = account;

    try {
      // 1) Create or get Auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name, last_name, role },
      });

      if (authError) {
        if (authError.message && authError.message.includes("already been registered")) {
          console.log(`  [SKIP] ${email} — already exists in Auth. Ensuring public.users row...`);
          const { data: existing } = await supabase.auth.admin.listUsers();
          const user = existing?.users?.find((u) => u.email === email);
          if (!user) {
            console.error(`  Could not find existing user for ${email}. Skip.`);
            continue;
          }
          await upsertUserRow(supabase, user.id, email, first_name, last_name, role);
          continue;
        }
        throw authError;
      }

      const userId = authData.user.id;
      console.log(`  [AUTH] ${email} (${role}) — created`);

      // 2) Insert into public.users
      const { error: dbError } = await supabase.from("users").insert({
        user_id: userId,
        email,
        first_name,
        last_name,
        role,
        status: "ACTIVE",
      });

      if (dbError) {
        if (dbError.code === "23505") {
          console.log(`  [SKIP] ${email} — row already in public.users`);
        } else {
          throw dbError;
        }
      } else {
        console.log(`  [USERS] ${email} — row inserted`);
      }
    } catch (err) {
      console.error(`  [ERROR] ${email}:`, err.message || err);
    }
  }

  console.log("\nDone. Use the emails and passwords above to log in.");
  console.log("  Admin:  /admin-login → admin@customsclear.local");
  console.log("  Broker: /login        → broker@customsclear.local");
  console.log("  Officer:/login       → officer@customsclear.local");
}

async function upsertUserRow(supabase, user_id, email, first_name, last_name, role) {
  const { error } = await supabase.from("users").upsert(
    {
      user_id,
      email,
      first_name,
      last_name,
      role,
      status: "ACTIVE",
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
  console.log(`  [USERS] ${email} — upserted`);
}

seed();
