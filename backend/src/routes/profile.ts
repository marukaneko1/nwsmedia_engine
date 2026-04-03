import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, email, username, first_name, last_name, role, phone, personal_email,
              google_voice_number, personal_phone, preferred_phone,
              date_of_birth, address_street, address_city, address_state, address_zip,
              join_date, schedule, emergency_contact_name, emergency_contact_phone, bio,
              profile_completed, created_at
       FROM users WHERE id = $1`,
      [req.user!.userId]
    );
    if (result.rows.length === 0) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.patch('/', async (req: Request, res: Response) => {
  try {
    const allowedFields = [
      'first_name', 'last_name', 'phone', 'personal_email',
      'personal_phone', 'preferred_phone', 'bio',
      'date_of_birth', 'address_street', 'address_city', 'address_state', 'address_zip',
      'emergency_contact_name', 'emergency_contact_phone',
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

    if (updates.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }

    updates.push(`updated_at = NOW()`);
    updates.push(`profile_completed = TRUE`);
    values.push(req.user!.userId);

    const result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}
       RETURNING id, email, username, first_name, last_name, role, phone, personal_email,
                 personal_phone, preferred_phone, bio, date_of_birth,
                 address_street, address_city, address_state, address_zip,
                 emergency_contact_name, emergency_contact_phone, profile_completed`,
      values
    );

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.post('/change-password', async (req: Request, res: Response) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) { res.status(400).json({ error: 'Both passwords required' }); return; }
    if (new_password.length < 8) { res.status(400).json({ error: 'Password must be at least 8 characters' }); return; }

    const user = await query('SELECT password_hash FROM users WHERE id = $1', [req.user!.userId]);
    if (user.rows.length === 0) { res.status(404).json({ error: 'User not found' }); return; }

    const valid = await bcrypt.compare(current_password, user.rows[0].password_hash);
    if (!valid) { res.status(400).json({ error: 'Current password is incorrect' }); return; }

    const hash = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.user!.userId]);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;
