"use server";

import { readFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import {
  getTemplateForStep,
  fillTemplate,
  buildIssuesFound,
} from "./email-templates";
import { getAccountCredentials } from "./email-accounts";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );
}

export interface BlastResult {
  businessId: number;
  name: string;
  email: string;
  ok: boolean;
  error?: string;
}

export async function sendBlastEmails(
  businessIds: number[],
  senderEmail?: string
): Promise<BlastResult[]> {
  const creds = getAccountCredentials(senderEmail);

  if (!creds) {
    return businessIds.map((id) => ({
      businessId: id,
      name: "",
      email: "",
      ok: false,
      error: "Gmail not configured",
    }));
  }

  const supabase = getSupabase();

  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, category, city, rating, review_count, website")
    .in("id", businessIds);

  const { data: enrichments } = await supabase
    .from("enrichment_data")
    .select("business_id, best_email, owner_name")
    .in("business_id", businessIds);

  const { data: triages } = await supabase
    .from("triage_results")
    .select("business_id, status")
    .in("business_id", businessIds);

  const { data: audits } = await supabase
    .from("website_audits")
    .select("business_id, performance_score, seo_score, ssl_valid, mobile_friendly")
    .in("business_id", businessIds);

  const { data: outreachRows } = await supabase
    .from("outreach_log")
    .select("business_id, follow_up_count")
    .in("business_id", businessIds)
    .order("sent_at", { ascending: false });

  const bizMap = Object.fromEntries((businesses ?? []).map((b) => [b.id, b]));
  const enrichMap = Object.fromEntries((enrichments ?? []).map((e) => [e.business_id, e]));
  const triageMap = Object.fromEntries((triages ?? []).map((t) => [t.business_id, t]));
  const auditMap = Object.fromEntries((audits ?? []).map((a) => [a.business_id, a]));

  const sentCountMap: Record<number, number> = {};
  for (const row of outreachRows ?? []) {
    if (sentCountMap[row.business_id] == null) {
      sentCountMap[row.business_id] = (row.follow_up_count ?? 0) + 1;
    }
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: creds.user, pass: creds.pass },
  });

  const results: BlastResult[] = [];

  for (const bizId of businessIds) {
    const biz = bizMap[bizId];
    const enrich = enrichMap[bizId];
    const email = enrich?.best_email;

    if (!biz || !email) {
      results.push({
        businessId: bizId,
        name: biz?.name ?? `#${bizId}`,
        email: email ?? "",
        ok: false,
        error: !email ? "No email address" : "Business not found",
      });
      continue;
    }

    const triageStatus = triageMap[bizId]?.status ?? "HAS_WEBSITE";
    const stepIndex = sentCountMap[bizId] ?? 0;
    const audit = auditMap[bizId];

    const template = getTemplateForStep(triageStatus, stepIndex);
    const filled = fillTemplate(template, {
      company_name: biz.name,
      first_name: enrich?.owner_name?.split(" ")[0] || "there",
      review_count: String(biz.review_count ?? ""),
      rating: String(biz.rating ?? ""),
      category: biz.category ?? "",
      city: biz.city ?? "",
      website: biz.website ?? "",
      issues_found: audit ? buildIssuesFound(audit) : "A few areas where the site could be optimized for speed and local search visibility",
    });

    const attachments: nodemailer.SendMailOptions["attachments"] = [];

    // Only attach audit PDF on follow-ups, not on the first initial email (avoids raising red flags)
    if (stepIndex > 0) {
      try {
        const { ensureAuditPdf } = await import("./generate-audit-pdf");
        const pdfPath = await ensureAuditPdf(bizId);
        if (pdfPath) {
          const pdfBuffer = await readFile(pdfPath);
          attachments.push({
            filename: path.basename(pdfPath),
            content: pdfBuffer,
            contentType: "application/pdf",
          });
        }
      } catch {
        // continue without PDF
      }
    }

    try {
      await transporter.sendMail({
        from: `${creds.displayName} <${creds.user}>`,
        to: email,
        subject: filled.subject,
        text: filled.body,
        attachments,
      });
    } catch (err) {
      results.push({
        businessId: bizId,
        name: biz.name,
        email,
        ok: false,
        error: err instanceof Error ? err.message : "Send failed",
      });
      continue;
    }

    const now = new Date().toISOString();

    await supabase.from("outreach_log").insert({
      business_id: bizId,
      source_channel: "gmail",
      outreach_type: "email",
      email_sent_to: email,
      status: "sent",
      sent_at: now,
      follow_up_count: stepIndex,
      notes: filled.subject,
    });

    if (stepIndex === 0) {
      const { data: existing } = await supabase
        .from("lead_lifecycle")
        .select("status")
        .eq("business_id", bizId)
        .order("changed_at", { ascending: false })
        .limit(1)
        .single();

      if (!existing || existing.status === "lead") {
        await supabase.from("lead_lifecycle").insert({
          business_id: bizId,
          status: "contacted",
          changed_at: now,
          notes: `Initial email sent via blast to ${email}`,
        });
      }
    }

    results.push({ businessId: bizId, name: biz.name, email, ok: true });

    // Small delay between sends to avoid rate limits
    await new Promise((r) => setTimeout(r, 1500));
  }

  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/pipeline");
  revalidatePath("/dashboard/outreach");
  revalidatePath("/dashboard");

  return results;
}
