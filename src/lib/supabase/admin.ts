import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client with the secret key. Bypasses row-level security, so use it only
 * after checking the caller is an admin, and never send it to the browser.
 */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
