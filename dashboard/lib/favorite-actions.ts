"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { invalidateCache } from "@/lib/queries";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key);
}

export async function toggleFavorite(
  businessId: number
): Promise<{ favorited: boolean }> {
  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from("favorites")
    .select("id")
    .eq("business_id", businessId)
    .maybeSingle();

  if (existing) {
    await supabase.from("favorites").delete().eq("business_id", businessId);
    invalidateCache("all_leads");
    invalidateCache("pipeline_leads");
    revalidatePath("/dashboard", "layout");
    return { favorited: false };
  }

  const { error } = await supabase
    .from("favorites")
    .insert({ business_id: businessId });

  if (error) throw new Error(`Failed to favorite: ${error.message}`);

  invalidateCache("all_leads");
  invalidateCache("pipeline_leads");
  revalidatePath("/dashboard", "layout");
  return { favorited: true };
}

export async function getFavoriteIds(): Promise<number[]> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("favorites")
    .select("business_id")
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => r.business_id);
}
