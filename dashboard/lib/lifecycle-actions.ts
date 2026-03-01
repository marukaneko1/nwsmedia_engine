"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      `Supabase env vars missing: URL=${!!url}, KEY=${!!key}`
    );
  }

  return createClient(url, key);
}

export async function updateLeadStatus(
  businessId: number,
  status: string,
  notes?: string
) {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("lead_lifecycle")
    .insert({
      business_id: businessId,
      status,
      notes: notes || null,
      changed_at: new Date().toISOString(),
    })
    .select();

  if (error) {
    throw new Error(`Failed to update status: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error("Insert returned no data — check RLS policies");
  }

  revalidatePath(`/dashboard/leads/${businessId}`);
  revalidatePath("/dashboard/pipeline");
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard");

  return { ok: true, id: data[0].id };
}
