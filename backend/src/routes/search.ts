import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (q.length < 2) { res.json({ results: [] }); return; }

    const pattern = `%${q}%`;
    const role = req.user!.role;
    const userId = req.user!.userId;
    const limit = 5;

    const results: { type: string; id: string; title: string; subtitle: string; link: string }[] = [];

    // Leads (VA sees own, admin/closer see all)
    const leadWhere = role === 'va'
      ? `AND l.assigned_to_id = '${userId}'`
      : '';
    const leads = await query(
      `SELECT l.id, l.company_name, l.contact_name, l.email, l.status
       FROM leads l
       WHERE (l.company_name ILIKE $1 OR l.contact_name ILIKE $1 OR l.email ILIKE $1) ${leadWhere}
       ORDER BY l.created_at DESC LIMIT $2`,
      [pattern, limit]
    );
    for (const r of leads.rows) {
      results.push({
        type: 'lead',
        id: r.id,
        title: r.company_name || r.contact_name,
        subtitle: `${r.contact_name || ''} · ${r.status}`,
        link: `/${role}/leads`,
      });
    }

    // Deals (closer sees own, admin sees all)
    const dealWhere = role === 'closer'
      ? `AND d.assigned_to_id = '${userId}'`
      : '';
    const deals = await query(
      `SELECT d.id, d.company_name, d.contact_name, d.stage, d.value
       FROM deals d
       WHERE (d.company_name ILIKE $1 OR d.contact_name ILIKE $1) ${dealWhere}
       ORDER BY d.created_at DESC LIMIT $2`,
      [pattern, limit]
    );
    for (const r of deals.rows) {
      results.push({
        type: 'deal',
        id: r.id,
        title: r.company_name,
        subtitle: `${r.stage} · $${(r.value || 0).toLocaleString()}`,
        link: `/${role}/deals/${r.id}`,
      });
    }

    // Users (admin only)
    if (role === 'admin') {
      const users = await query(
        `SELECT id, first_name, last_name, email, role FROM users
         WHERE (first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1) AND status != 'deleted'
         ORDER BY first_name LIMIT $2`,
        [pattern, limit]
      );
      for (const r of users.rows) {
        results.push({
          type: 'user',
          id: r.id,
          title: `${r.first_name} ${r.last_name}`,
          subtitle: `${r.role} · ${r.email}`,
          link: `/admin/users`,
        });
      }
    }

    // Projects (ops + admin)
    if (role === 'ops' || role === 'admin') {
      const projects = await query(
        `SELECT p.id, p.name, p.status, p.client_company
         FROM projects p
         WHERE (p.name ILIKE $1 OR p.client_company ILIKE $1)
         ORDER BY p.created_at DESC LIMIT $2`,
        [pattern, limit]
      );
      for (const r of projects.rows) {
        results.push({
          type: 'project',
          id: r.id,
          title: r.name,
          subtitle: `${r.client_company || ''} · ${r.status}`,
          link: `/${role}/projects/${r.id}`,
        });
      }
    }

    res.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
