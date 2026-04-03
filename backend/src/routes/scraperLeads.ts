import { Router, Request, Response } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { engineQuery, isEngineDbConfigured } from '../config/engineDb';

const router = Router();
router.use(authenticateToken);
router.use(requireRole('admin'));

function ensureEngineDb(_req: Request, res: Response, next: Function) {
  if (!isEngineDbConfigured()) {
    res.status(503).json({ error: 'Lead engine database is not configured (ENGINE_DATABASE_URL)' });
    return;
  }
  next();
}

router.use(ensureEngineDb);

// GET /api/scraper/leads -- Paginated, filterable leads from the engine DB
router.get('/leads', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize as string) || 100));
    const search = (req.query.q as string || '').trim();
    const city = (req.query.city as string || '').trim();
    const tier = (req.query.tier as string || '').trim().toUpperCase();
    const segment = (req.query.segment as string || '').trim().toUpperCase();
    const email = (req.query.email as string || '').trim();
    const triage = (req.query.triage as string || '').trim().toUpperCase();
    const source = (req.query.source as string || '').trim();

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (search) {
      conditions.push(`(b.name ILIKE $${idx} OR b.category ILIKE $${idx} OR b.email ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (city) {
      conditions.push(`b.city = $${idx}`);
      params.push(city);
      idx++;
    }
    if (tier && ['HOT', 'WARM', 'COOL', 'COLD', 'SKIP'].includes(tier)) {
      conditions.push(`ls.tier = $${idx}`);
      params.push(tier);
      idx++;
    }
    if (segment && ['ESTABLISHED', 'NEW_SMALL'].includes(segment)) {
      conditions.push(`ls.segment = $${idx}`);
      params.push(segment);
      idx++;
    }
    if (email === 'has') {
      conditions.push(`(b.email IS NOT NULL AND b.email != '')`);
    } else if (email === 'no') {
      conditions.push(`(b.email IS NULL OR b.email = '')`);
    }
    if (triage) {
      conditions.push(`tr.status = $${idx}`);
      params.push(triage);
      idx++;
    }
    if (source) {
      conditions.push(`b.source_channel = $${idx}`);
      params.push(source);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await engineQuery(
      `SELECT COUNT(*) FROM businesses b
       LEFT JOIN lead_scores ls ON ls.business_id = b.id
       LEFT JOIN triage_results tr ON tr.business_id = b.id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const offset = (page - 1) * pageSize;
    const dataParams = [...params, pageSize, offset];

    const dataResult = await engineQuery(
      `SELECT
         b.id, b.name, b.category, b.city, b.state, b.phone, b.email, b.website,
         b.rating, b.review_count, b.maps_url, b.source_channel, b.source_url,
         b.scraped_at, b.address,
         ls.score, ls.tier, ls.segment,
         tr.status AS triage_status
       FROM businesses b
       LEFT JOIN lead_scores ls ON ls.business_id = b.id
       LEFT JOIN triage_results tr ON tr.business_id = b.id
       ${whereClause}
       ORDER BY ls.score DESC NULLS LAST, b.scraped_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      dataParams
    );

    res.json({
      leads: dataResult.rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    console.error('Scraper leads query error:', err);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// GET /api/scraper/leads/stats -- KPI stats for the engine overview
router.get('/leads/stats', async (_req: Request, res: Response) => {
  try {
    const result = await engineQuery(`
      SELECT
        (SELECT COUNT(*) FROM businesses) AS total_leads,
        (SELECT COUNT(*) FROM businesses WHERE email IS NOT NULL AND email != '') AS with_email,
        (SELECT COUNT(*) FROM lead_scores WHERE tier = 'HOT') AS hot_leads,
        (SELECT COUNT(*) FROM lead_scores WHERE tier = 'WARM') AS warm_leads,
        (SELECT COUNT(*) FROM lead_scores WHERE tier = 'COOL') AS cool_leads,
        (SELECT COUNT(*) FROM lead_scores WHERE tier = 'COLD') AS cold_leads,
        (SELECT COUNT(*) FROM businesses WHERE source_channel = 'craigslist') AS craigslist_leads,
        (SELECT COUNT(*) FROM businesses WHERE source_channel = 'google_maps' OR source_channel IS NULL) AS gmaps_leads,
        (SELECT COUNT(*) FROM businesses WHERE source_channel = 'yelp') AS yelp_leads,
        (SELECT COUNT(*) FROM businesses WHERE source_channel LIKE 'sos_%') AS filings_leads,
        (SELECT COUNT(*) FROM businesses WHERE scraped_at > NOW() - INTERVAL '24 hours') AS leads_24h,
        (SELECT COUNT(*) FROM businesses WHERE scraped_at > NOW() - INTERVAL '7 days') AS leads_7d
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Scraper stats query error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/scraper/leads/cities -- Distinct cities for filter dropdown
router.get('/leads/cities', async (_req: Request, res: Response) => {
  try {
    const result = await engineQuery(
      `SELECT DISTINCT city FROM businesses WHERE city IS NOT NULL AND city != '' ORDER BY city`
    );
    res.json(result.rows.map((r: { city: string }) => r.city));
  } catch (err) {
    console.error('Scraper cities query error:', err);
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
});

// GET /api/scraper/leads/:id -- Full detail for one lead
router.get('/leads/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const bizResult = await engineQuery(
      `SELECT b.*,
         ls.score, ls.tier, ls.segment,
         tr.status AS triage_status, tr.http_status, tr.redirect_url,
         ed.best_email, ed.all_emails, ed.owner_name, ed.owner_position,
         ed.social_profiles, ed.enrichment_source
       FROM businesses b
       LEFT JOIN lead_scores ls ON ls.business_id = b.id
       LEFT JOIN triage_results tr ON tr.business_id = b.id
       LEFT JOIN enrichment_data ed ON ed.business_id = b.id
       WHERE b.id = $1`,
      [id]
    );

    if (bizResult.rows.length === 0) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    const lead = bizResult.rows[0];

    // Fetch audit data if available
    let audit = null;
    try {
      const auditResult = await engineQuery(
        `SELECT * FROM website_audits WHERE business_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [id]
      );
      if (auditResult.rows.length > 0) audit = auditResult.rows[0];
    } catch {
      // Table may not exist yet
    }

    // Fetch outreach logs if available
    let outreach: unknown[] = [];
    try {
      const outreachResult = await engineQuery(
        `SELECT * FROM outreach_log WHERE business_id = $1 ORDER BY sent_at DESC`,
        [id]
      );
      outreach = outreachResult.rows;
    } catch {
      // Table may not exist yet
    }

    res.json({ ...lead, audit, outreach });
  } catch (err) {
    console.error('Scraper lead detail error:', err);
    res.status(500).json({ error: 'Failed to fetch lead detail' });
  }
});

export default router;
