import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { count, error } = await supabase
    .from("prov")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }

  console.log(`✅ Rows in 'prov' table: ${count}`);
  console.log("Data looks good!");
}

main();
