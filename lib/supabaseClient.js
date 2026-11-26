"use client";

import { createClient } from "@supabase/supabase-js";

// Browser-side Supabase client (safe to expose the anon/publishable key).
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
