"use server";

import { readFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import nodemailer from "nodemailer";
import { supabase } from "./db";
import { getAccountCredentials } from "./email-accounts";

export async function sendOutreachEmail(params: {
  businessId: number;
  to: string;
  subject: string;
  body: string;
  followUpCount: number;
  senderEmail?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const creds = getAccountCredentials(params.senderEmail);

  if (!creds) {
    return {
      ok: false,
      error:
        "Gmail not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD to .env.local",
    };
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: creds.user, pass: creds.pass },
  });

  const attachments: nodemailer.SendMailOptions["attachments"] = [];

  // Only attach audit PDF on follow-ups, not on the first initial email (avoids raising red flags)
  if (params.followUpCount > 0) {
    try {
      const { ensureAuditPdf } = await import("./generate-audit-pdf");
      const pdfPath = await ensureAuditPdf(params.businessId);
      if (pdfPath) {
        const pdfBuffer = await readFile(pdfPath);
        attachments.push({
          filename: path.basename(pdfPath),
          content: pdfBuffer,
          contentType: "application/pdf",
        });
      }
    } catch {
      // PDF generation failed — send email without attachment
    }
  }

  try {
    await transporter.sendMail({
      from: `${creds.displayName} <${creds.user}>`,
      to: params.to,
      subject: params.subject,
      text: params.body,
      attachments,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown email error";
    return { ok: false, error: msg };
  }

  const now = new Date().toISOString();

  await supabase.from("outreach_log").insert({
    business_id: params.businessId,
    source_channel: "gmail",
    outreach_type: "email",
    email_sent_to: params.to,
    status: "sent",
    sent_at: now,
    follow_up_count: params.followUpCount,
    notes: params.subject,
  });

  if (params.followUpCount === 0) {
    const { data: existing } = await supabase
      .from("lead_lifecycle")
      .select("status")
      .eq("business_id", params.businessId)
      .order("changed_at", { ascending: false })
      .limit(1)
      .single();

    if (!existing || existing.status === "lead") {
      await supabase.from("lead_lifecycle").insert({
        business_id: params.businessId,
        status: "contacted",
        changed_at: now,
        notes: "Initial email sent via dashboard",
      });
    }
  }

  revalidatePath(`/dashboard/leads/${params.businessId}`);
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/pipeline");
  revalidatePath("/dashboard");

  return { ok: true };
}
