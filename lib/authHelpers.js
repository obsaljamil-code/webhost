"use client";

import { supabase } from "@/lib/supabaseClient";

// Turns whatever the person typed in the "username or email" field into an
// email address Supabase can sign in with. If it already looks like an
// email, use it as-is; otherwise look up the username.
export async function resolveLoginEmail(identifier) {
  const value = identifier.trim();
  if (value.includes("@")) return value;

  const { data, error } = await supabase.rpc("email_for_username", {
    p_username: value.toLowerCase(),
  });
  if (error || !data) return null;
  return data;
}

export function generatePassword(length = 14) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let out = "";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}
