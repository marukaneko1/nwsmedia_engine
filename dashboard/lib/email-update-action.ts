"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key);
}

export async function updateBusinessEmail(
  businessId: number,
  email: string
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = email.trim();
  if (!trimmed) return { ok: false, error: "Email cannot be empty" };

  const supabase = getSupabase();

  const { error: bizErr } = await supabase
    .from("businesses")
    .update({ email: trimmed })
    .eq("id", businessId);

  if (bizErr) return { ok: false, error: bizErr.message };

  const { data: existing } = await supabase
    .from("enrichment_data")
    .select("id")
    .eq("business_id", businessId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("enrichment_data")
      .update({ best_email: trimmed, enrichment_source: "manual" })
      .eq("business_id", businessId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("enrichment_data").insert({
      business_id: businessId,
      best_email: trimmed,
      enrichment_source: "manual",
      enriched_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/dashboard/leads/${businessId}`);
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/pipeline");
  revalidatePath("/dashboard/outreach");

  return { ok: true };
}
