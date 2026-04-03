import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/export', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const [userResult, leadsResult, activitiesResult, commissionsResult] = await Promise.all([
      query('SELECT id, email, first_name, last_name, phone, role, status, created_at FROM users WHERE id = $1', [userId]),
      query('SELECT * FROM leads WHERE assigned_va_id = $1', [userId]),
      query('SELECT * FROM activities WHERE created_by_id = $1', [userId]),
      query('SELECT * FROM commissions WHERE user_id = $1', [userId]),
    ]);

    res.json({
      exported_at: new Date().toISOString(),
      user: userResult.rows[0] || null,
      leads: leadsResult.rows,
      activities: activitiesResult.rows,
      commissions: commissionsResult.rows,
    });
  } catch (error) {
    console.error('GDPR export error:', error);
    res.status(500).json({ error: 'Failed to export user data' });
  }
});

router.delete('/delete-account', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const result = await query(
      `UPDATE users SET
        email = $1,
        first_name = 'Deleted',
        last_name = 'User',
        phone = NULL,
        status = 'deleted',
        updated_at = NOW()
      WHERE id = $2 RETURNING id`,
      [`deleted-${userId}@nwsmedia.com`, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ message: 'Account anonymized successfully' });
  } catch (error) {
    console.error('GDPR delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;
