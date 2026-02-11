/**
 * Clear all submission data from database.
 * Deletes: document_sets, documents, extracted_fields, validation_results, tax_computation
 * Keeps: user accounts, audit_logs (for history)
 *
 * Run: npm run clear-db
 */

// ENV FIRST
require("./load-env.js");

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function clearDatabase() {
  console.log("🗑️  Clearing submission data from database...\n");

  try {
    // 1) Count before deletion
    const { count: docSetsCount } = await supabase
      .from("document_sets")
      .select("*", { count: "exact", head: true });

    const { count: docsCount } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true });

    const { count: fieldsCount } = await supabase
      .from("extracted_fields")
      .select("*", { count: "exact", head: true });

    console.log("📊 Current data:");
    console.log(`   - Document sets: ${docSetsCount || 0}`);
    console.log(`   - Documents: ${docsCount || 0}`);
    console.log(`   - Extracted fields: ${fieldsCount || 0}\n`);

    if ((docSetsCount || 0) === 0) {
      console.log("✅ Database is already empty. Nothing to clear.");
      return;
    }

    // 2) Get all document_set_ids to delete
    const { data: allSets } = await supabase
      .from("document_sets")
      .select("document_set_id");

    if (!allSets || allSets.length === 0) {
      console.log("✅ No document sets to clear.");
      return;
    }

    const setIds = allSets.map((s) => s.document_set_id);
    console.log(`🔄 Deleting ${setIds.length} document set(s) and related data...\n`);

    // Get all document_ids
    const { data: allDocs } = await supabase
      .from("documents")
      .select("document_id")
      .in("document_set_id", setIds);

    const docIds = (allDocs || []).map((d) => d.document_id);

    // 3) Delete in correct order (child tables first)
    
    // Tax computations (if exists)
    if (setIds.length > 0) {
      const { error: taxErr } = await supabase
        .from("tax_computation")
        .delete()
        .in("document_set_id", setIds);
      
      if (taxErr && taxErr.code !== "42P01") {
        console.log(`   ⚠️  Tax computation: ${taxErr.message}`);
      } else {
        console.log("   ✓ Tax computations cleared");
      }
    }

    // Validation results (if exists)
    if (setIds.length > 0) {
      const { error: validationErr } = await supabase
        .from("validation_results")
        .delete()
        .in("document_set_id", setIds);
      
      if (validationErr && validationErr.code !== "42P01") {
        console.log(`   ⚠️  Validation results: ${validationErr.message}`);
      } else {
        console.log("   ✓ Validation results cleared");
      }
    }

    // Extracted fields
    if (docIds.length > 0) {
      const { error: fieldsErr } = await supabase
        .from("extracted_fields")
        .delete()
        .in("document_id", docIds);
      
      if (fieldsErr) {
        console.error(`   ❌ Extracted fields: ${fieldsErr.message}`);
      } else {
        console.log("   ✓ Extracted fields cleared");
      }
    }

    // Documents
    if (setIds.length > 0) {
      const { error: docsErr } = await supabase
        .from("documents")
        .delete()
        .in("document_set_id", setIds);
      
      if (docsErr) {
        console.error(`   ❌ Documents: ${docsErr.message}`);
      } else {
        console.log("   ✓ Documents cleared");
      }
    }

    // Document sets
    const { error: setsErr } = await supabase
      .from("document_sets")
      .delete()
      .in("document_set_id", setIds);
    
    if (setsErr) {
      console.error(`   ❌ Document sets: ${setsErr.message}`);
    } else {
      console.log("   ✓ Document sets cleared");
    }

    // 3) Clear storage bucket
    console.log("\n🗂️  Clearing storage bucket...");
    const { data: files } = await supabase.storage.from("documents").list();

    if (files && files.length > 0) {
      const paths = files.map((f) => f.name);
      const { error: storageErr } = await supabase.storage.from("documents").remove(paths);
      
      if (storageErr) {
        console.log(`   ⚠️  Storage: ${storageErr.message}`);
      } else {
        console.log(`   ✓ Removed ${paths.length} file(s) from storage`);
      }
    } else {
      console.log("   ✓ Storage bucket is empty");
    }

    console.log("\n✅ Database cleared successfully!");
    console.log("\n📝 User accounts preserved:");
    console.log("   - admin@customsclear.local");
    console.log("   - broker@customsclear.local");
    console.log("   - officer@customsclear.local");
    console.log("\nYou can now start fresh debugging. Run npm run dev to test.");

  } catch (err) {
    console.error("\n❌ Error:", err.message || err);
    process.exit(1);
  }
}

clearDatabase();
