import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
router.use(requireRole('admin'));

router.get('/overview', async (_req: Request, res: Response) => {
  try {
    const [leads, deals, clients, revenue, commissions] = await Promise.all([
      query(`SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE stage = 'new') as new_leads,
        COUNT(*) FILTER (WHERE stage = 'qualified') as qualified,
        COUNT(*) FILTER (WHERE stage = 'converted') as converted,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as last_30_days
        FROM leads`),
      query(`SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE stage = 'discovery') as discovery,
        COUNT(*) FILTER (WHERE stage = 'proposal_sent') as proposal_sent,
        COUNT(*) FILTER (WHERE stage = 'contract_sent') as contract_sent,
        COUNT(*) FILTER (WHERE stage = 'awaiting_deposit') as awaiting_deposit,
        COUNT(*) FILTER (WHERE stage = 'won') as won,
        COUNT(*) FILTER (WHERE stage = 'lost') as lost,
        COALESCE(SUM(estimated_value) FILTER (WHERE stage NOT IN ('won','lost')), 0) as pipeline_value,
        COALESCE(SUM(CASE
          WHEN stage = 'discovery' THEN estimated_value * 0.20
          WHEN stage = 'proposal_sent' THEN estimated_value * 0.40
          WHEN stage = 'contract_sent' THEN estimated_value * 0.70
          WHEN stage = 'awaiting_deposit' THEN estimated_value * 0.95
          ELSE 0 END), 0) as weighted_pipeline
        FROM deals`),
      query(`SELECT COUNT(*) as total,
        COUNT(*) FILTER (WHERE project_status = 'in_progress') as active
        FROM clients`),
      query(`SELECT
        COALESCE(SUM(amount), 0) as total_revenue,
        COALESCE(SUM(amount) FILTER (WHERE completed_at >= NOW() - INTERVAL '30 days'), 0) as revenue_30d
        FROM transactions WHERE status = 'completed' AND transaction_type = 'payment'`),
      query(`SELECT
        COALESCE(SUM(commission_amount) FILTER (WHERE status = 'pending'), 0) as pending,
        COALESCE(SUM(commission_amount) FILTER (WHERE status = 'paid'), 0) as paid
        FROM commissions`),
    ]);

    res.json({
      leads: leads.rows[0],
      deals: deals.rows[0],
      clients: clients.rows[0],
      revenue: revenue.rows[0],
      commissions: commissions.rows[0],
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

router.get('/pipeline', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT stage, COUNT(*) as count, COALESCE(SUM(estimated_value), 0) as value
       FROM deals WHERE stage NOT IN ('won', 'lost')
       GROUP BY stage ORDER BY stage`
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Pipeline analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline data' });
  }
});

router.get('/team-performance', async (_req: Request, res: Response) => {
  try {
    const vaPerf = await query(
      `SELECT u.id, u.first_name, u.last_name,
        COUNT(DISTINCT l.id) as total_leads,
        COUNT(DISTINCT l.id) FILTER (WHERE l.stage = 'converted') as qualified_leads,
        COUNT(DISTINCT a.id) FILTER (WHERE a.activity_type = 'call') as total_calls,
        COALESCE(SUM(c.commission_amount), 0) as total_commissions
       FROM users u
       LEFT JOIN leads l ON l.assigned_va_id = u.id
       LEFT JOIN activities a ON a.created_by_id = u.id
       LEFT JOIN commissions c ON c.user_id = u.id
       WHERE u.role = 'va' AND u.status = 'active'
       GROUP BY u.id, u.first_name, u.last_name`
    );

    const closerPerf = await query(
      `SELECT u.id, u.first_name, u.last_name,
        COUNT(DISTINCT d.id) as total_deals,
        COUNT(DISTINCT d.id) FILTER (WHERE d.stage = 'won') as won_deals,
        COALESCE(SUM(d.actual_value) FILTER (WHERE d.stage = 'won'), 0) as revenue,
        COALESCE(SUM(c.commission_amount), 0) as total_commissions
       FROM users u
       LEFT JOIN deals d ON d.assigned_closer_id = u.id
       LEFT JOIN commissions c ON c.user_id = u.id
       WHERE u.role = 'closer' AND u.status = 'active'
       GROUP BY u.id, u.first_name, u.last_name`
    );

    res.json({ va_performance: vaPerf.rows, closer_performance: closerPerf.rows });
  } catch (error) {
    console.error('Team performance error:', error);
    res.status(500).json({ error: 'Failed to fetch team performance' });
  }
});

// GET /revenue-timeseries
router.get('/revenue-timeseries', async (req: Request, res: Response) => {
  try {
    const period = req.query.period === 'weekly' ? 'week' : 'month';
    const months = parseInt(req.query.months as string, 10) || 12;

    const result = await query(
      `SELECT DATE_TRUNC($1, completed_at) as period, SUM(amount) as revenue
       FROM transactions
       WHERE status = 'completed'
         AND transaction_type = 'payment'
         AND completed_at >= NOW() - INTERVAL '1 month' * $2
       GROUP BY 1
       ORDER BY 1`,
      [period, months]
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Revenue timeseries error:', error);
    res.status(500).json({ error: 'Failed to fetch revenue timeseries' });
  }
});

// GET /conversion-funnel
router.get('/conversion-funnel', async (_req: Request, res: Response) => {
  try {
    const [leadResult, dealResult] = await Promise.all([
      query(`SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE stage IN ('contacted', 'qualified', 'converted')) as contacted,
        COUNT(*) FILTER (WHERE stage IN ('qualified', 'converted')) as qualified
        FROM leads`),
      query(`SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE stage = 'won') as won
        FROM deals`),
    ]);

    const totalLeads = parseInt(leadResult.rows[0].total, 10) || 0;
    const contacted = parseInt(leadResult.rows[0].contacted, 10) || 0;
    const qualified = parseInt(leadResult.rows[0].qualified, 10) || 0;
    const dealsCreated = parseInt(dealResult.rows[0].total, 10) || 0;
    const dealsWon = parseInt(dealResult.rows[0].won, 10) || 0;

    const pct = (n: number) => totalLeads > 0 ? Math.round((n / totalLeads) * 10000) / 100 : 0;

    res.json({
      funnel: [
        { stage: 'Total Leads', count: totalLeads, percentage: 100 },
        { stage: 'Contacted', count: contacted, percentage: pct(contacted) },
        { stage: 'Qualified', count: qualified, percentage: pct(qualified) },
        { stage: 'Deals Created', count: dealsCreated, percentage: pct(dealsCreated) },
        { stage: 'Deals Won', count: dealsWon, percentage: pct(dealsWon) },
      ],
    });
  } catch (error) {
    console.error('Conversion funnel error:', error);
    res.status(500).json({ error: 'Failed to fetch conversion funnel' });
  }
});

// GET /forecasting
router.get('/forecasting', async (_req: Request, res: Response) => {
  try {
    const [pipelineResult, closeRateResult, byStageResult] = await Promise.all([
      query(`SELECT COALESCE(SUM(
        CASE
          WHEN stage = 'discovery' THEN estimated_value * 0.20
          WHEN stage = 'proposal_sent' THEN estimated_value * 0.40
          WHEN stage = 'contract_sent' THEN estimated_value * 0.70
          WHEN stage = 'awaiting_deposit' THEN estimated_value * 0.95
          ELSE 0
        END), 0) as weighted_pipeline
        FROM deals
        WHERE stage NOT IN ('won', 'lost')`),
      query(`SELECT
        COUNT(*) FILTER (WHERE stage = 'won') as won,
        COUNT(*) FILTER (WHERE stage IN ('won', 'lost')) as total_closed
        FROM deals
        WHERE updated_at >= NOW() - INTERVAL '90 days'
          AND stage IN ('won', 'lost')`),
      query(`SELECT stage, COUNT(*) as count, COALESCE(SUM(estimated_value), 0) as value
        FROM deals
        WHERE stage NOT IN ('won', 'lost')
        GROUP BY stage`),
    ]);

    const weightedPipeline = parseFloat(pipelineResult.rows[0].weighted_pipeline);
    const won = parseInt(closeRateResult.rows[0].won, 10) || 0;
    const totalClosed = parseInt(closeRateResult.rows[0].total_closed, 10) || 0;
    const avgCloseRate = totalClosed > 0 ? Math.round((won / totalClosed) * 10000) / 10000 : 0;
    const projectedMonthlyRevenue = Math.round(weightedPipeline * avgCloseRate * 100) / 100;

    res.json({
      weighted_pipeline: weightedPipeline,
      avg_close_rate: avgCloseRate,
      projected_monthly_revenue: projectedMonthlyRevenue,
      deals_by_stage: byStageResult.rows,
    });
  } catch (error) {
    console.error('Forecasting error:', error);
    res.status(500).json({ error: 'Failed to fetch forecasting data' });
  }
});

// GET /va-effectiveness
router.get('/va-effectiveness', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT
        u.id,
        u.first_name,
        u.last_name,
        COUNT(DISTINCT l.id) as total_leads,
        COUNT(DISTINCT a.id) FILTER (WHERE a.activity_type = 'call') as calls_made,
        COUNT(DISTINCT l.id) FILTER (WHERE l.stage IN ('qualified', 'converted')) as qualified_leads,
        CASE
          WHEN COUNT(DISTINCT l.id) > 0
          THEN ROUND(COUNT(DISTINCT l.id) FILTER (WHERE l.stage IN ('qualified', 'converted'))::numeric
               / COUNT(DISTINCT l.id) * 100, 2)
          ELSE 0
        END as conversion_rate,
        COALESCE(AVG(l.icp_score) FILTER (WHERE l.stage IN ('qualified', 'converted')), 0) as avg_icp_converted
       FROM users u
       LEFT JOIN leads l ON l.assigned_va_id = u.id
       LEFT JOIN activities a ON a.created_by_id = u.id
       WHERE u.role = 'va' AND u.status = 'active'
       GROUP BY u.id, u.first_name, u.last_name`
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('VA effectiveness error:', error);
    res.status(500).json({ error: 'Failed to fetch VA effectiveness' });
  }
});

// GET /closer-metrics
router.get('/closer-metrics', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT
        u.id,
        u.first_name,
        u.last_name,
        COUNT(DISTINCT d.id) as total_deals,
        COUNT(DISTINCT d.id) FILTER (WHERE d.stage = 'won') as won,
        COUNT(DISTINCT d.id) FILTER (WHERE d.stage = 'lost') as lost,
        CASE
          WHEN COUNT(DISTINCT d.id) FILTER (WHERE d.stage IN ('won', 'lost')) > 0
          THEN ROUND(COUNT(DISTINCT d.id) FILTER (WHERE d.stage = 'won')::numeric
               / COUNT(DISTINCT d.id) FILTER (WHERE d.stage IN ('won', 'lost')) * 100, 2)
          ELSE 0
        END as win_rate,
        COALESCE(AVG(d.actual_value) FILTER (WHERE d.stage = 'won'), 0) as avg_deal_size,
        COALESCE(AVG(EXTRACT(EPOCH FROM (d.updated_at - d.created_at)) / 86400)
          FILTER (WHERE d.stage IN ('won', 'lost')), 0) as avg_cycle_days
       FROM users u
       LEFT JOIN deals d ON d.assigned_closer_id = u.id
       WHERE u.role = 'closer' AND u.status = 'active'
       GROUP BY u.id, u.first_name, u.last_name`
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Closer metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch closer metrics' });
  }
});

export default router;
