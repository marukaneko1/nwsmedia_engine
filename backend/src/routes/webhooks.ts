import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { calculateICPScore } from '../services/icpScoring';

const router = Router();

// Stripe webhook (placeholder -- real Stripe SDK integration added when keys configured)
router.post('/stripe', async (req: Request, res: Response) => {
  try {
    const event = req.body;

    if (!event || !event.type) {
      res.sendStatus(400);
      return;
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handleStripePaymentSuccess(event.data?.object);
        break;
      case 'payment_intent.payment_failed':
        await handleStripePaymentFailure(event.data?.object);
        break;
      case 'charge.refunded':
        await handleStripeRefund(event.data?.object);
        break;
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Stripe webhook error:', error);
    res.sendStatus(500);
  }
});

async function handleStripePaymentSuccess(paymentIntent: any) {
  if (!paymentIntent?.metadata?.deal_id) return;

  const { id, amount, metadata } = paymentIntent;

  const plResult = await query(
    'SELECT * FROM payment_links WHERE stripe_payment_intent_id = $1',
    [id]
  );

  if (plResult.rows.length === 0) return;
  const pl = plResult.rows[0];

  await query(
    `UPDATE payment_links SET status = 'paid', paid_at = NOW(), paid_amount = $1, updated_at = NOW() WHERE id = $2`,
    [amount / 100, pl.id]
  );

  await query(
    `INSERT INTO transactions (payment_link_id, transaction_type, amount, processor, processor_transaction_id, status, completed_at)
     VALUES ($1, 'payment', $2, 'stripe', $3, 'completed', NOW())`,
    [pl.id, amount / 100, id]
  );

  // Trigger commission calculation
  const deal = await query('SELECT * FROM deals WHERE id = $1', [metadata.deal_id]);
  if (deal.rows.length === 0) return;
  const d = deal.rows[0];

  if (metadata.payment_type === 'deposit') {
    await query(`UPDATE deals SET deposit_received_at = NOW(), stage = 'won', updated_at = NOW() WHERE id = $1`, [d.id]);

    // VA commission: 10% or $500 min
    if (d.originating_va_id) {
      const dealValue = parseFloat(d.actual_value || d.estimated_value || '0');
      const commAmount = Math.max(dealValue * 0.10, 500);
      await query(
        `INSERT INTO commissions (user_id, deal_id, commission_type, deal_value, commission_percentage, commission_amount, status, trigger_event, triggered_at, rule_applied)
         VALUES ($1,$2,'va_deposit',$3,10.00,$4,'pending','deposit_received',NOW(),'VA Standard: 10% or $500 minimum')`,
        [d.originating_va_id, d.id, dealValue, commAmount]
      );
    }
  } else if (metadata.payment_type === 'final') {
    await query(`UPDATE deals SET final_payment_received_at = NOW(), updated_at = NOW() WHERE id = $1`, [d.id]);

    // Closer commission: tiered
    const dealValue = parseFloat(d.actual_value || d.estimated_value || '0');
    let pct = 15;
    if (dealValue > 25000) pct = 20;
    else if (dealValue > 10000) pct = 18;
    const commAmount = dealValue * (pct / 100);

    await query(
      `INSERT INTO commissions (user_id, deal_id, commission_type, deal_value, commission_percentage, commission_amount, status, trigger_event, triggered_at, rule_applied)
       VALUES ($1,$2,'closer_final',$3,$4,$5,'pending','final_payment_received',NOW(),$6)`,
      [d.assigned_closer_id, d.id, dealValue, pct, commAmount, `Closer Tiered: ${pct}%`]
    );
  }
}

async function handleStripePaymentFailure(paymentIntent: any) {
  if (!paymentIntent?.id) return;
  await query(
    `UPDATE payment_links SET updated_at = NOW() WHERE stripe_payment_intent_id = $1`,
    [paymentIntent.id]
  );
}

async function handleStripeRefund(charge: any) {
  if (!charge?.payment_intent) return;

  const plResult = await query(
    'SELECT * FROM payment_links WHERE stripe_payment_intent_id = $1',
    [charge.payment_intent]
  );
  if (plResult.rows.length === 0) return;

  await query(
    `INSERT INTO transactions (payment_link_id, transaction_type, amount, processor, status, completed_at)
     VALUES ($1, 'refund', $2, 'stripe', 'completed', NOW())`,
    [plResult.rows[0].id, (charge.amount_refunded || 0) / 100]
  );

  // Void related commissions
  if (plResult.rows[0].deal_id) {
    await query(
      `UPDATE commissions SET status = 'voided', voided_at = NOW(), void_reason = 'Payment refunded', updated_at = NOW()
       WHERE deal_id = $1 AND status IN ('pending', 'approved')`,
      [plResult.rows[0].deal_id]
    );
  }
}

// Square webhook
router.post('/square', async (req: Request, res: Response) => {
  // Placeholder for Square integration
  res.sendStatus(200);
});

// PayPal IPN
router.post('/paypal', async (req: Request, res: Response) => {
  // Placeholder for PayPal integration
  res.sendStatus(200);
});

// --- Lead Capture Webhooks ---

async function createScraperLead(lead: Record<string, any>, sourceDetail: string): Promise<boolean> {
  if (!lead.company_name) return false;

  const existing = await query('SELECT id FROM leads WHERE company_name = $1', [lead.company_name]);
  if (existing.rows.length > 0) return false;

  const icpResult = calculateICPScore({
    industry: lead.industry,
    location_city: lead.city,
    location_state: lead.state,
    estimated_revenue: lead.estimated_revenue ? parseFloat(lead.estimated_revenue) : undefined,
  });

  await query(
    `INSERT INTO leads (company_name, phone, address, website, source, source_detail, icp_score, status)
     VALUES ($1, $2, $3, $4, 'scraper', $5, $6, 'new')`,
    [
      lead.company_name,
      lead.phone || null,
      lead.address || null,
      lead.website || null,
      sourceDetail,
      icpResult.score,
    ]
  );
  return true;
}

router.post('/scraper/google-maps', async (req: Request, res: Response) => {
  try {
    const { leads } = req.body;
    if (!Array.isArray(leads)) {
      res.status(400).json({ error: 'leads array is required' });
      return;
    }

    let created = 0;
    let skipped = 0;
    for (const lead of leads) {
      const wasCreated = await createScraperLead(lead, 'google_maps');
      if (wasCreated) created++;
      else skipped++;
    }

    res.json({ created, skipped });
  } catch (error) {
    console.error('Google Maps scraper webhook error:', error);
    res.status(500).json({ error: 'Failed to process leads' });
  }
});

router.post('/scraper/apify', async (req: Request, res: Response) => {
  try {
    const { leads } = req.body;
    if (!Array.isArray(leads)) {
      res.status(400).json({ error: 'leads array is required' });
      return;
    }

    let created = 0;
    let skipped = 0;
    for (const lead of leads) {
      const wasCreated = await createScraperLead(lead, 'apify');
      if (wasCreated) created++;
      else skipped++;
    }

    res.json({ created, skipped });
  } catch (error) {
    console.error('Apify scraper webhook error:', error);
    res.status(500).json({ error: 'Failed to process leads' });
  }
});

router.post('/meta-ads', async (req: Request, res: Response) => {
  try {
    const { entry } = req.body;
    if (!Array.isArray(entry)) {
      res.status(400).json({ error: 'Invalid Meta webhook payload' });
      return;
    }

    let created = 0;
    for (const e of entry) {
      const changes = e.changes || [];
      for (const change of changes) {
        const value = change.value || {};
        const name = value.full_name || value.name || '';
        const email = value.email || '';
        const phone = value.phone_number || value.phone || '';
        const company = value.company_name || value.company || '';

        const nameParts = name.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        await query(
          `INSERT INTO leads (company_name, contact_name, contact_email, phone, source, source_detail, status)
           VALUES ($1, $2, $3, $4, 'meta_ad', $5, 'new')`,
          [
            company || `${firstName} ${lastName}`.trim(),
            `${firstName} ${lastName}`.trim(),
            email || null,
            phone || null,
            value.form_id || 'lead_form',
          ]
        );
        created++;
      }
    }

    res.json({ created });
  } catch (error) {
    console.error('Meta Ads webhook error:', error);
    res.status(500).json({ error: 'Failed to process Meta lead' });
  }
});

export default router;
