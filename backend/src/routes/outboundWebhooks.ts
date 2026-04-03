import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
router.use(requireRole('admin'));

query(`CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url VARCHAR(500) NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  secret VARCHAR(255),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
)`).catch(err => console.error('Failed to ensure webhook_subscriptions table:', err));

router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM webhook_subscriptions ORDER BY created_at DESC');
    res.json({ data: result.rows });
  } catch (error) {
    console.error('List webhook subscriptions error:', error);
    res.status(500).json({ error: 'Failed to list webhook subscriptions' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { url, events, secret } = req.body;

    if (!url || !Array.isArray(events) || events.length === 0) {
      res.status(400).json({ error: 'url and events[] are required' });
      return;
    }

    const validEvents = [
      'lead.created', 'lead.qualified',
      'deal.created', 'deal.won', 'deal.lost',
      'payment.received', 'commission.created',
    ];
    const invalid = events.filter((e: string) => !validEvents.includes(e));
    if (invalid.length > 0) {
      res.status(400).json({ error: `Invalid event types: ${invalid.join(', ')}` });
      return;
    }

    const result = await query(
      `INSERT INTO webhook_subscriptions (url, events, secret)
       VALUES ($1, $2, $3) RETURNING *`,
      [url, events, secret || null]
    );

    res.status(201).json({ subscription: result.rows[0] });
  } catch (error) {
    console.error('Create webhook subscription error:', error);
    res.status(500).json({ error: 'Failed to create webhook subscription' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await query(
      'DELETE FROM webhook_subscriptions WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    res.json({ message: 'Subscription deleted' });
  } catch (error) {
    console.error('Delete webhook subscription error:', error);
    res.status(500).json({ error: 'Failed to delete webhook subscription' });
  }
});

export async function fireWebhook(eventType: string, payload: object): Promise<void> {
  try {
    const result = await query(
      'SELECT * FROM webhook_subscriptions WHERE active = TRUE AND $1 = ANY(events)',
      [eventType]
    );

    for (const sub of result.rows) {
      fetch(sub.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: eventType,
          data: payload,
          timestamp: new Date().toISOString(),
        }),
      }).catch(err => console.error(`Webhook delivery failed for ${sub.url}:`, err));
    }
  } catch (error) {
    console.error('fireWebhook error:', error);
  }
}

export default router;
