import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from("venues")
    .select("id, name, slug, spot_type, neighborhood")
    .eq("active", true)
    .order("name");

  if (error) {
    console.error("Error:", error);
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));
}

main();
