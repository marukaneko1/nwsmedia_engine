import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken, requireRole } from '../middleware/auth';
import { logAudit } from '../services/audit';
import { calculateICPScore } from '../services/icpScoring';
import { assignLead } from '../services/leadAssignment';

const router = Router();

router.use(authenticateToken);

router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      assigned_va_id, assigned_closer_id, stage, source, search, unassigned,
      page = '1', limit = '50', sort = 'created_at', order = 'desc',
    } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];
    let idx = 1;

    if (assigned_va_id) { whereClause += ` AND assigned_va_id = $${idx++}`; params.push(assigned_va_id); }
    if (assigned_closer_id) { whereClause += ` AND assigned_closer_id = $${idx++}`; params.push(assigned_closer_id); }
    if (stage) { whereClause += ` AND stage = $${idx++}`; params.push(stage); }
    if (source) { whereClause += ` AND source = $${idx++}`; params.push(source); }

    if (unassigned === 'true') {
      whereClause += ` AND assigned_va_id IS NULL AND stage NOT IN ('converted','lost')`;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const term = `%${search.trim()}%`;
      whereClause += ` AND (first_name ILIKE $${idx} OR last_name ILIKE $${idx} OR company_name ILIKE $${idx} OR email ILIKE $${idx} OR phone ILIKE $${idx})`;
      params.push(term);
      idx++;
    }

    // Scope VAs to their own leads
    if (req.user!.role === 'va') {
      whereClause += ` AND assigned_va_id = $${idx++}`;
      params.push(req.user!.userId);
    }
    if (req.user!.role === 'closer') {
      whereClause += ` AND assigned_closer_id = $${idx++}`;
      params.push(req.user!.userId);
    }

    const allowedSorts = ['created_at', 'icp_score', 'next_followup_at', 'company_name'];
    const sortCol = allowedSorts.includes(sort as string) ? sort : 'created_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    const countResult = await query(`SELECT COUNT(*) FROM leads ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(limitNum, offset);
    const result = await query(
      `SELECT * FROM leads ${whereClause} ORDER BY ${sortCol} ${sortOrder} NULLS LAST LIMIT $${idx++} OFFSET $${idx}`,
      params
    );

    res.json({ data: result.rows, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (error) {
    console.error('List leads error:', error);
    res.status(500).json({ error: 'Failed to list leads' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    const activities = await query(
      `SELECT a.*, u.first_name as created_by_first, u.last_name as created_by_last
       FROM activities a
       LEFT JOIN users u ON a.created_by_id = u.id
       WHERE a.lead_id = $1
       ORDER BY a.created_at DESC`,
      [req.params.id]
    );

    res.json({ lead: result.rows[0], activities: activities.rows });
  } catch (error) {
    console.error('Get lead error:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      first_name, last_name, company_name, email, phone, linkedin_url, website_url,
      source, source_detail, utm_source, utm_medium, utm_campaign,
      industry, company_size_min, company_size_max, estimated_revenue,
      location_city, location_state, location_zip, website_quality_score, tags,
    } = req.body;

    if (!source) {
      res.status(400).json({ error: 'source is required' });
      return;
    }

    // Duplicate detection
    if (email) {
      const dup = await query('SELECT id FROM leads WHERE email = $1', [email]);
      if (dup.rows.length > 0) {
        res.status(409).json({ error: 'Lead with this email already exists', existing_id: dup.rows[0].id });
        return;
      }
    }
    if (phone) {
      const normalized = phone.replace(/\D/g, '');
      const dup = await query("SELECT id FROM leads WHERE REGEXP_REPLACE(phone, '\\D', '', 'g') = $1", [normalized]);
      if (dup.rows.length > 0) {
        res.status(409).json({ error: 'Lead with this phone already exists', existing_id: dup.rows[0].id });
        return;
      }
    }

    const { score, factors } = calculateICPScore({
      company_size_min, company_size_max, industry,
      location_city, location_state, website_quality_score, estimated_revenue,
    });

    const result = await query(
      `INSERT INTO leads (
        first_name, last_name, company_name, email, phone, linkedin_url, website_url,
        source, source_detail, utm_source, utm_medium, utm_campaign,
        industry, company_size_min, company_size_max, estimated_revenue,
        location_city, location_state, location_zip, website_quality_score,
        icp_score, icp_score_factors, tags
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
      RETURNING *`,
      [
        first_name || null, last_name || null, company_name || null, email || null, phone || null,
        linkedin_url || null, website_url || null, source, source_detail || null,
        utm_source || null, utm_medium || null, utm_campaign || null,
        industry || null, company_size_min || null, company_size_max || null, estimated_revenue || null,
        location_city || null, location_state || null, location_zip || null, website_quality_score || null,
        score, JSON.stringify(factors), tags || null,
      ]
    );

    const lead = result.rows[0];

    // Auto-assign to VA
    try {
      await assignLead(lead.id, 'round_robin');
    } catch { /* no VAs available yet is fine */ }

    await logAudit({
      userId: req.user!.userId,
      action: 'create',
      entityType: 'lead',
      entityId: lead.id,
    });

    // Re-fetch with assignment
    const fresh = await query('SELECT * FROM leads WHERE id = $1', [lead.id]);
    res.status(201).json({ lead: fresh.rows[0] });
  } catch (error) {
    console.error('Create lead error:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const allowedFields = [
      'first_name', 'last_name', 'company_name', 'email', 'phone', 'linkedin_url', 'website_url',
      'source', 'source_detail', 'industry', 'company_size_min', 'company_size_max', 'estimated_revenue',
      'location_city', 'location_state', 'location_zip', 'website_quality_score',
      'assigned_va_id', 'assigned_closer_id', 'stage', 'last_contacted_at', 'next_followup_at',
      'contact_attempts', 'loss_reason', 'loss_notes', 'tags',
    ];

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${idx++}`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    // Recalculate ICP if relevant fields changed
    const icpFields = ['company_size_min', 'company_size_max', 'industry', 'location_city', 'location_state', 'website_quality_score', 'estimated_revenue'];
    if (icpFields.some(f => req.body[f] !== undefined)) {
      const existing = await query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
      if (existing.rows.length > 0) {
        const merged = { ...existing.rows[0], ...req.body };
        const { score, factors } = calculateICPScore(merged);
        updates.push(`icp_score = $${idx++}`);
        values.push(score);
        updates.push(`icp_score_factors = $${idx++}`);
        values.push(JSON.stringify(factors));
      }
    }

    if (req.body.stage === 'lost') {
      updates.push(`lost_at = NOW()`);
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);

    const result = await query(
      `UPDATE leads SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    await logAudit({
      userId: req.user!.userId,
      action: 'update',
      entityType: 'lead',
      entityId: req.params.id,
      changes: req.body,
    });

    res.json({ lead: result.rows[0] });
  } catch (error) {
    console.error('Update lead error:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

router.delete('/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const result = await query('DELETE FROM leads WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    await logAudit({
      userId: req.user!.userId,
      action: 'delete',
      entityType: 'lead',
      entityId: req.params.id,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

// Qualify lead -> create deal
router.post('/:id/qualify', requireRole('va', 'admin'), async (req: Request, res: Response) => {
  try {
    const { assigned_closer_id, pain_point, budget_min, budget_max, timeline, decision_maker, handoff_notes } = req.body;

    if (!assigned_closer_id) {
      res.status(400).json({ error: 'assigned_closer_id is required' });
      return;
    }

    const leadResult = await query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
    if (leadResult.rows.length === 0) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }
    const lead = leadResult.rows[0];

    if (lead.stage === 'converted') {
      res.status(400).json({ error: 'Lead already converted' });
      return;
    }

    // Create deal
    const dealResult = await query(
      `INSERT INTO deals (
        lead_id, assigned_closer_id, originating_va_id, company_name, contact_name,
        contact_email, contact_phone, pain_point, budget_range_min, budget_range_max,
        timeline, decision_maker_name, stage
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'discovery')
      RETURNING *`,
      [
        lead.id, assigned_closer_id, req.user!.userId,
        lead.company_name || 'Unknown', `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown',
        lead.email, lead.phone, pain_point || null, budget_min || null, budget_max || null,
        timeline || null, decision_maker || null,
      ]
    );

    const deal = dealResult.rows[0];

    // Update lead stage
    await query(
      `UPDATE leads SET stage = 'converted', assigned_closer_id = $1, converted_to_deal_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [assigned_closer_id, lead.id]
    );

    // Create handoff activity
    await query(
      `INSERT INTO activities (lead_id, deal_id, activity_type, notes, created_by_id) VALUES ($1, $2, 'handoff', $3, $4)`,
      [lead.id, deal.id, handoff_notes || 'Lead qualified and handed off', req.user!.userId]
    );

    await logAudit({
      userId: req.user!.userId,
      action: 'qualify',
      entityType: 'lead',
      entityId: lead.id,
      changes: { deal_id: { old: null, new: deal.id } },
    });

    res.status(201).json({ deal });
  } catch (error) {
    console.error('Qualify lead error:', error);
    res.status(500).json({ error: 'Failed to qualify lead' });
  }
});

// Bulk CSV/XLSX import
router.post('/import', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { leads: leadsData, source: importSource, assigned_va_id: defaultVa } = req.body;

    if (!Array.isArray(leadsData) || leadsData.length === 0) {
      res.status(400).json({ error: 'leads array is required' });
      return;
    }

    const results = { created: 0, duplicates: 0, errors: 0, ids: [] as string[] };

    // Fetch existing emails & phones in bulk for dedup
    const existingEmails = new Set<string>();
    const existingPhones = new Set<string>();
    const emailRes = await query("SELECT LOWER(email) AS e FROM leads WHERE email IS NOT NULL");
    for (const r of emailRes.rows) existingEmails.add(r.e);
    const phoneRes = await query("SELECT REGEXP_REPLACE(phone, '\\D', '', 'g') AS p FROM leads WHERE phone IS NOT NULL");
    for (const r of phoneRes.rows) if (r.p.length >= 7) existingPhones.add(r.p);

    // Filter duplicates and prepare insert rows
    const toInsert: Array<{
      first_name: string | null; last_name: string | null; company_name: string | null;
      email: string | null; phone: string | null; source: string;
      source_detail: string | null; utm_source: string | null; utm_medium: string | null;
      utm_campaign: string | null; industry: string | null;
      location_city: string | null; location_state: string | null;
      location_zip: string | null; website_url: string | null; linkedin_url: string | null;
      company_size_min: number | null; company_size_max: number | null;
      estimated_revenue: number | null; tags: string[] | null;
      icp_score: number; icp_score_factors: string; assigned_va_id: string | null;
    }> = [];

    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();

    for (const row of leadsData) {
      const email = row.email ? String(row.email).trim().toLowerCase() : '';
      const phone = row.phone ? String(row.phone).replace(/\D/g, '') : '';

      if (email && (existingEmails.has(email) || seenEmails.has(email))) { results.duplicates++; continue; }
      if (phone && phone.length >= 7 && (existingPhones.has(phone) || seenPhones.has(phone))) { results.duplicates++; continue; }

      if (email) seenEmails.add(email);
      if (phone && phone.length >= 7) seenPhones.add(phone);

      const { score, factors } = calculateICPScore(row);

      const parseNum = (v: unknown): number | null => {
        if (v == null || v === '') return null;
        const n = Number(String(v).replace(/[^0-9.-]/g, ''));
        return isNaN(n) ? null : n;
      };

      let tags: string[] | null = null;
      if (row.tags) {
        tags = typeof row.tags === 'string'
          ? row.tags.split(/[,;|]/).map((t: string) => t.trim()).filter(Boolean)
          : Array.isArray(row.tags) ? row.tags : null;
      }

      toInsert.push({
        first_name: row.first_name || null,
        last_name: row.last_name || null,
        company_name: row.company_name || null,
        email: row.email || null,
        phone: row.phone || null,
        source: row.source || importSource || 'csv_import',
        source_detail: row.source_detail || null,
        utm_source: row.utm_source || null,
        utm_medium: row.utm_medium || null,
        utm_campaign: row.utm_campaign || null,
        industry: row.industry || null,
        location_city: row.location_city || null,
        location_state: row.location_state || null,
        location_zip: row.location_zip || null,
        website_url: row.website_url || null,
        linkedin_url: row.linkedin_url || null,
        company_size_min: parseNum(row.company_size_min),
        company_size_max: parseNum(row.company_size_max),
        estimated_revenue: parseNum(row.estimated_revenue),
        tags,
        icp_score: score,
        icp_score_factors: JSON.stringify(factors),
        assigned_va_id: defaultVa || null,
      });
    }

    const COLS_PER_ROW = 23;
    const CHUNK = 500;
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const chunk = toInsert.slice(i, i + CHUNK);
      const values: unknown[] = [];
      const placeholders: string[] = [];

      for (let j = 0; j < chunk.length; j++) {
        const r = chunk[j];
        const off = j * COLS_PER_ROW;
        placeholders.push(
          `($${off+1},$${off+2},$${off+3},$${off+4},$${off+5},$${off+6},$${off+7},$${off+8},$${off+9},$${off+10},$${off+11},$${off+12},$${off+13},$${off+14},$${off+15},$${off+16},$${off+17},$${off+18},$${off+19},$${off+20},$${off+21},$${off+22},$${off+23},'new')`
        );
        values.push(
          r.first_name, r.last_name, r.company_name, r.email, r.phone,
          r.source, r.source_detail, r.utm_source, r.utm_medium, r.utm_campaign,
          r.industry, r.location_city, r.location_state, r.location_zip,
          r.website_url, r.linkedin_url,
          r.company_size_min, r.company_size_max, r.estimated_revenue, r.tags,
          r.icp_score, r.icp_score_factors, r.assigned_va_id,
        );
      }

      try {
        const insertRes = await query(
          `INSERT INTO leads (first_name, last_name, company_name, email, phone,
           source, source_detail, utm_source, utm_medium, utm_campaign,
           industry, location_city, location_state, location_zip,
           website_url, linkedin_url,
           company_size_min, company_size_max, estimated_revenue, tags,
           icp_score, icp_score_factors, assigned_va_id, stage)
           VALUES ${placeholders.join(',')} RETURNING id`,
          values,
        );
        results.created += insertRes.rows.length;
        for (const row of insertRes.rows) results.ids.push(row.id);
      } catch (err) {
        console.error('Batch insert error (chunk offset ' + i + '):', err);
        results.errors += chunk.length;
      }
    }

    await logAudit({
      userId: req.user!.userId,
      action: 'import',
      entityType: 'lead',
      changes: { imported: results.created, duplicates: results.duplicates, errors: results.errors },
    });

    res.json({ results });
  } catch (error) {
    console.error('Import leads error:', error);
    res.status(500).json({ error: 'Failed to import leads' });
  }
});

// Bulk assign leads to VAs
router.post('/bulk-assign', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { assignments } = req.body;

    if (!Array.isArray(assignments) || assignments.length === 0) {
      res.status(400).json({ error: 'assignments array is required (each: { lead_ids: string[], va_id: string })' });
      return;
    }

    let updated = 0;
    for (const { lead_ids, va_id } of assignments) {
      if (!Array.isArray(lead_ids) || !va_id) continue;
      const result = await query(
        `UPDATE leads SET assigned_va_id = $1, updated_at = NOW() WHERE id = ANY($2::uuid[])`,
        [va_id, lead_ids]
      );
      updated += result.rowCount ?? 0;
    }

    await logAudit({
      userId: req.user!.userId,
      action: 'bulk_assign',
      entityType: 'lead',
      changes: { updated },
    });

    res.json({ updated });
  } catch (error) {
    console.error('Bulk assign error:', error);
    res.status(500).json({ error: 'Failed to bulk assign leads' });
  }
});

// Distribute leads evenly among VAs (round-robin)
router.post('/distribute', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { lead_ids, va_ids } = req.body;

    if (!Array.isArray(lead_ids) || lead_ids.length === 0 || !Array.isArray(va_ids) || va_ids.length === 0) {
      res.status(400).json({ error: 'lead_ids and va_ids arrays are required' });
      return;
    }

    let updated = 0;
    for (let i = 0; i < lead_ids.length; i++) {
      const vaId = va_ids[i % va_ids.length];
      const result = await query(
        `UPDATE leads SET assigned_va_id = $1, updated_at = NOW() WHERE id = $2`,
        [vaId, lead_ids[i]]
      );
      updated += result.rowCount ?? 0;
    }

    await logAudit({
      userId: req.user!.userId,
      action: 'distribute',
      entityType: 'lead',
      changes: { lead_count: lead_ids.length, va_count: va_ids.length },
    });

    res.json({ updated, distribution: va_ids.map((id: string, idx: number) => ({
      va_id: id,
      count: lead_ids.filter((_: string, i: number) => i % va_ids.length === idx).length,
    }))});
  } catch (error) {
    console.error('Distribute leads error:', error);
    res.status(500).json({ error: 'Failed to distribute leads' });
  }
});

export default router;
