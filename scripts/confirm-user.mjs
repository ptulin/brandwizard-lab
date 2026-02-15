#!/usr/bin/env node
/**
 * One-off: confirm ptulin@gmail.com so they can sign in without email link.
 * Run: SUPABASE_URL=https://YOUR_PROJECT.supabase.co SUPABASE_SERVICE_ROLE_KEY=your_secret_key node scripts/confirm-user.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userId = "a48a4cbb-896d-4045-a517-c5def652d90a";

if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await supabase.auth.admin.updateUserById(userId, {
  email_confirm: true,
});

if (error) {
  console.error("Error:", error.message);
  process.exit(1);
}
console.log("User confirmed:", data?.user?.email);
process.exit(0);
