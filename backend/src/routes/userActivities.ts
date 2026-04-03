import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);
router.use(requireRole('admin'));

router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      user_id,
      action,
      ip_address,
      country,
      device_type,
      date_from,
      date_to,
      search,
      page = '1',
      limit = '50',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const offset = (pageNum - 1) * limitNum;

    let where = 'WHERE 1=1';
    const params: unknown[] = [];
    let idx = 1;

    if (user_id) { where += ` AND a.user_id = $${idx++}`; params.push(user_id); }
    if (action) { where += ` AND a.action = $${idx++}`; params.push(action); }
    if (ip_address) { where += ` AND a.ip_address = $${idx++}`; params.push(ip_address); }
    if (country) { where += ` AND a.country = $${idx++}`; params.push(country); }
    if (device_type) { where += ` AND a.device_type = $${idx++}`; params.push(device_type); }
    if (date_from) { where += ` AND a.created_at >= $${idx++}`; params.push(date_from); }
    if (date_to) { where += ` AND a.created_at <= $${idx++}`; params.push(date_to); }
    if (search) {
      where += ` AND (a.endpoint ILIKE $${idx} OR a.ip_address ILIKE $${idx} OR a.city ILIKE $${idx} OR a.country ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    const countResult = await query(`SELECT COUNT(*) FROM user_activity_log a ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(limitNum, offset);
    const result = await query(
      `SELECT a.*, u.first_name, u.last_name, u.role AS user_role, u.email AS user_email
       FROM user_activity_log a
       LEFT JOIN users u ON u.id = a.user_id
       ${where}
       ORDER BY a.created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      params
    );

    res.json({
      data: result.rows,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error('User activities error:', error);
    res.status(500).json({ error: 'Failed to fetch user activities' });
  }
});

router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [
      totalResult,
      last24hResult,
      activeUsersResult,
      topUsersResult,
      actionBreakdownResult,
      countriesResult,
      devicesResult,
      browsersResult,
      hourlyResult,
    ] = await Promise.all([
      query(`SELECT COUNT(*) FROM user_activity_log`),
      query(`SELECT COUNT(*) FROM user_activity_log WHERE created_at > NOW() - INTERVAL '24 hours'`),
      query(`SELECT COUNT(DISTINCT user_id) FROM user_activity_log WHERE created_at > NOW() - INTERVAL '1 hour'`),
      query(`
        SELECT u.id, u.first_name, u.last_name, u.role, COUNT(*) AS activity_count,
               MAX(a.created_at) AS last_seen,
               (SELECT ip_address FROM user_activity_log WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) AS last_ip,
               (SELECT city FROM user_activity_log WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) AS last_city,
               (SELECT country FROM user_activity_log WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) AS last_country
        FROM user_activity_log a
        JOIN users u ON u.id = a.user_id
        WHERE a.created_at > NOW() - INTERVAL '24 hours'
        GROUP BY u.id, u.first_name, u.last_name, u.role
        ORDER BY activity_count DESC
        LIMIT 10
      `),
      query(`
        SELECT action, COUNT(*) AS count
        FROM user_activity_log
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY action ORDER BY count DESC
      `),
      query(`
        SELECT country, country_code, COUNT(*) AS count
        FROM user_activity_log
        WHERE country IS NOT NULL AND created_at > NOW() - INTERVAL '7 days'
        GROUP BY country, country_code ORDER BY count DESC
        LIMIT 10
      `),
      query(`
        SELECT device_type, COUNT(*) AS count
        FROM user_activity_log
        WHERE device_type IS NOT NULL AND created_at > NOW() - INTERVAL '7 days'
        GROUP BY device_type ORDER BY count DESC
      `),
      query(`
        SELECT browser, COUNT(*) AS count
        FROM user_activity_log
        WHERE browser IS NOT NULL AND created_at > NOW() - INTERVAL '7 days'
        GROUP BY browser ORDER BY count DESC
      `),
      query(`
        SELECT EXTRACT(HOUR FROM created_at) AS hour, COUNT(*) AS count
        FROM user_activity_log
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY hour ORDER BY hour
      `),
    ]);

    const uniqueIps = await query(
      `SELECT COUNT(DISTINCT ip_address) FROM user_activity_log WHERE created_at > NOW() - INTERVAL '24 hours'`
    );

    res.json({
      total: parseInt(totalResult.rows[0].count, 10),
      last24h: parseInt(last24hResult.rows[0].count, 10),
      activeUsersNow: parseInt(activeUsersResult.rows[0].count, 10),
      uniqueIps24h: parseInt(uniqueIps.rows[0].count, 10),
      topUsers: topUsersResult.rows,
      actionBreakdown: actionBreakdownResult.rows,
      countries: countriesResult.rows,
      devices: devicesResult.rows,
      browsers: browsersResult.rows,
      hourlyActivity: hourlyResult.rows,
    });
  } catch (error) {
    console.error('User activity stats error:', error);
    res.status(500).json({ error: 'Failed to get activity stats' });
  }
});

router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { page = '1', limit = '30' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const offset = (pageNum - 1) * limitNum;

    const [countResult, result, userResult] = await Promise.all([
      query(`SELECT COUNT(*) FROM user_activity_log WHERE user_id = $1`, [userId]),
      query(
        `SELECT a.*, u.first_name, u.last_name, u.role AS user_role
         FROM user_activity_log a
         LEFT JOIN users u ON u.id = a.user_id
         WHERE a.user_id = $1
         ORDER BY a.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limitNum, offset]
      ),
      query(
        `SELECT id, first_name, last_name, email, role, status, last_login_at FROM users WHERE id = $1`,
        [userId]
      ),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    res.json({
      user: userResult.rows[0] || null,
      data: result.rows,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error('User activity detail error:', error);
    res.status(500).json({ error: 'Failed to fetch user activity' });
  }
});

router.get('/live', async (_req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT DISTINCT ON (a.user_id)
        a.user_id, a.action, a.endpoint, a.ip_address, a.city, a.country,
        a.device_type, a.browser, a.os, a.created_at,
        u.first_name, u.last_name, u.role, u.email
      FROM user_activity_log a
      JOIN users u ON u.id = a.user_id
      WHERE a.created_at > NOW() - INTERVAL '15 minutes'
      ORDER BY a.user_id, a.created_at DESC
    `);

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Live activity error:', error);
    res.status(500).json({ error: 'Failed to fetch live activity' });
  }
});

export default router;
