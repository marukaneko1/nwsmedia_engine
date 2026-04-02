import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_ANON_KEY (e.g. load dashboard/.env.local before running)"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TABLES = [
  "businesses",
  "enrichment_data",
  "triage_results",
  "lead_scores",
  "outreach_log",
  "favorites",
  "lead_lifecycle",
  "website_audits",
];

const DESKTOP = path.join(
  process.env.USERPROFILE || process.env.HOME || ".",
  "Desktop",
  "supabase_backup"
);

async function fetchAll(table) {
  const PAGE = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + PAGE - 1);
    if (error) {
      console.error(`  ERROR fetching ${table}: ${error.message}`);
      break;
    }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function deleteAll(table) {
  const { error: err1 } = await supabase.from(table).delete().gt("id", 0);
  if (err1) {
    const { error: err2 } = await supabase
      .from(table)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (err2) {
      const { error: err3 } = await supabase.from(table).delete().gte("id", 0);
      if (err3) {
        console.error(`  ERROR deleting ${table}: ${err3.message}`);
        return false;
      }
    }
  }
  return true;
}

async function main() {
  console.log("=== Supabase Data Export ===\n");
  console.log(`Backup folder: ${DESKTOP}\n`);

  fs.mkdirSync(DESKTOP, { recursive: true });

  const counts = {};
  for (const table of TABLES) {
    process.stdout.write(`Exporting ${table}...`);
    const data = await fetchAll(table);
    counts[table] = data.length;
    const filePath = path.join(DESKTOP, `${table}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(` ${data.length} rows -> ${table}.json`);
  }

  console.log("\n=== Export Complete ===");
  console.log("Table row counts:");
  for (const [t, c] of Object.entries(counts)) {
    console.log(`  ${t}: ${c}`);
  }
  const totalRows = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`  TOTAL: ${totalRows} rows\n`);

  if (totalRows === 0) {
    console.log("No data to delete. Done.");
    return;
  }

  const deleteOrder = [
    "outreach_log",
    "lead_lifecycle",
    "website_audits",
    "favorites",
    "lead_scores",
    "triage_results",
    "enrichment_data",
    "businesses",
  ];

  console.log("=== Deleting data from Supabase ===\n");
  for (const table of deleteOrder) {
    if (counts[table] === 0) {
      console.log(`  ${table}: skipped (empty)`);
      continue;
    }
    process.stdout.write(`  Deleting ${table} (${counts[table]} rows)...`);
    const ok = await deleteAll(table);
    console.log(ok ? " done" : " FAILED");
  }

  console.log("\n=== All done! ===");
  console.log(`Backup saved to: ${DESKTOP}`);
}

main().catch(console.error);
