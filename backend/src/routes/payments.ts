import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken, requireRole } from '../middleware/auth';
import { logAudit } from '../services/audit';

const router = Router();

// Public: get payment link by slug (no auth)
router.get('/pay/:slug', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT pl.*, d.company_name, d.contact_name, d.contact_email
       FROM payment_links pl
       LEFT JOIN deals d ON pl.deal_id = d.id
       WHERE pl.slug = $1`,
      [req.params.slug]
    );

    if (result.rows.length === 0 || result.rows[0].status !== 'pending') {
      res.status(404).json({ error: 'Payment link not found or no longer active' });
      return;
    }

    // Track view
    await query('UPDATE payment_links SET viewed_at = COALESCE(viewed_at, NOW()) WHERE slug = $1', [req.params.slug]);

    res.json({ payment_link: result.rows[0] });
  } catch (error) {
    console.error('Get payment link error:', error);
    res.status(500).json({ error: 'Failed to fetch payment link' });
  }
});

// Authenticated routes
router.use(authenticateToken);

router.get('/', async (req: Request, res: Response) => {
  try {
    const { deal_id, client_id, status } = req.query;
    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];
    let idx = 1;

    if (deal_id) { whereClause += ` AND deal_id = $${idx++}`; params.push(deal_id); }
    if (client_id) { whereClause += ` AND client_id = $${idx++}`; params.push(client_id); }
    if (status) { whereClause += ` AND status = $${idx++}`; params.push(status); }

    const result = await query(
      `SELECT * FROM payment_links ${whereClause} ORDER BY created_at DESC`,
      params
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('List payment links error:', error);
    res.status(500).json({ error: 'Failed to list payment links' });
  }
});

router.post('/create', requireRole('closer', 'admin', 'ops'), async (req: Request, res: Response) => {
  try {
    const { deal_id, client_id, amount, payment_type, processor, due_date, description } = req.body;

    if (!amount || !payment_type || !processor) {
      res.status(400).json({ error: 'amount, payment_type, and processor are required' });
      return;
    }

    const slug = `${(deal_id || 'pay').slice(0, 8)}-${Date.now()}`;

    const result = await query(
      `INSERT INTO payment_links (deal_id, client_id, created_by_id, slug, payment_type, amount,
       description, processor, payment_methods_enabled, due_date, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, NOW() + INTERVAL '30 days')
       RETURNING *`,
      [
        deal_id || null, client_id || null, req.user!.userId, slug,
        payment_type, amount, description || null, processor,
        ['card', 'ach'], due_date || null,
      ]
    );

    await logAudit({
      userId: req.user!.userId,
      action: 'create',
      entityType: 'payment_link',
      entityId: result.rows[0].id,
    });

    res.status(201).json({
      payment_link: {
        ...result.rows[0],
        url: `${process.env.PAYMENT_PAGE_URL || 'http://localhost:5173/pay'}/${slug}`,
      },
    });
  } catch (error) {
    console.error('Create payment link error:', error);
    res.status(500).json({ error: 'Failed to create payment link' });
  }
});

router.post('/:id/void', requireRole('admin', 'closer'), async (req: Request, res: Response) => {
  try {
    const result = await query(
      `UPDATE payment_links SET status = 'voided', updated_at = NOW() WHERE id = $1 AND status = 'pending' RETURNING *`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Payment link not found or not voidable' });
      return;
    }

    await logAudit({
      userId: req.user!.userId,
      action: 'void',
      entityType: 'payment_link',
      entityId: req.params.id,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Void payment link error:', error);
    res.status(500).json({ error: 'Failed to void payment link' });
  }
});

// Invoice endpoints
router.get('/invoices', async (req: Request, res: Response) => {
  try {
    const { deal_id, client_id, status } = req.query;
    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];
    let idx = 1;

    if (deal_id) { whereClause += ` AND deal_id = $${idx++}`; params.push(deal_id); }
    if (client_id) { whereClause += ` AND client_id = $${idx++}`; params.push(client_id); }
    if (status) { whereClause += ` AND status = $${idx++}`; params.push(status); }

    const result = await query(`SELECT * FROM invoices ${whereClause} ORDER BY created_at DESC`, params);
    res.json({ data: result.rows });
  } catch (error) {
    console.error('List invoices error:', error);
    res.status(500).json({ error: 'Failed to list invoices' });
  }
});

router.post('/invoices/create', requireRole('admin', 'closer', 'ops'), async (req: Request, res: Response) => {
  try {
    const { deal_id, client_id, invoice_type, amount, line_items, due_date, payment_terms } = req.body;

    // Generate sequential invoice number
    const countResult = await query('SELECT COUNT(*) FROM invoices');
    const count = parseInt(countResult.rows[0].count, 10) + 1;
    const year = new Date().getFullYear();
    const invoiceNumber = `NWS-${year}-${String(count).padStart(4, '0')}`;

    const totalAmount = amount || 0;

    const result = await query(
      `INSERT INTO invoices (invoice_number, deal_id, client_id, invoice_type, amount, total_amount,
       line_items, due_date, payment_terms, balance_due)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        invoiceNumber, deal_id || null, client_id || null, invoice_type || 'deposit',
        totalAmount, totalAmount, line_items ? JSON.stringify(line_items) : null,
        due_date || null, payment_terms || 'due_on_receipt', totalAmount,
      ]
    );

    res.status(201).json({ invoice: result.rows[0] });
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// Transactions
router.get('/transactions', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { client_id, page = '1', limit = '50' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];
    let idx = 1;

    if (client_id) { whereClause += ` AND client_id = $${idx++}`; params.push(client_id); }

    params.push(limitNum, offset);
    const result = await query(
      `SELECT * FROM transactions ${whereClause} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
      params
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('List transactions error:', error);
    res.status(500).json({ error: 'Failed to list transactions' });
  }
});

export default router;
