import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query } from '../config/database';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// File upload setup
const uploadDir = path.join(__dirname, '../../uploads/training');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`),
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// ── List materials (employees see their role's materials + completion status) ─
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;

    let sql: string;
    let params: unknown[];

    if (role === 'admin') {
      sql = `
        SELECT tm.*,
               u.first_name AS creator_first, u.last_name AS creator_last,
               (SELECT COUNT(*) FROM training_completions tc WHERE tc.material_id = tm.id) AS completion_count,
               (SELECT COUNT(DISTINCT usr.id) FROM users usr WHERE usr.status = 'active' AND usr.role = ANY(tm.target_roles)) AS target_count
        FROM training_materials tm
        LEFT JOIN users u ON u.id = tm.created_by_id
        ORDER BY tm.category, tm.sort_order, tm.created_at`;
      params = [];
    } else {
      sql = `
        SELECT tm.*,
               CASE WHEN tc.id IS NOT NULL THEN TRUE ELSE FALSE END AS completed,
               tc.completed_at
        FROM training_materials tm
        LEFT JOIN training_completions tc ON tc.material_id = tm.id AND tc.user_id = $1
        WHERE $2 = ANY(tm.target_roles) OR 'all' = ANY(tm.target_roles)
        ORDER BY tm.category, tm.sort_order, tm.created_at`;
      params = [userId, role];
    }

    const result = await query(sql, params);
    res.json({ materials: result.rows });
  } catch (error) {
    console.error('List training materials error:', error);
    res.status(500).json({ error: 'Failed to list training materials' });
  }
});

// ── Admin: upload training material ─────────────────────────────────────
router.post('/', requireRole('admin'), upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'File is required' }); return; }

    const { title, description, category, target_roles, required, sort_order } = req.body;
    if (!title) { res.status(400).json({ error: 'title is required' }); return; }

    const roles = typeof target_roles === 'string' ? target_roles.split(',').map((r: string) => r.trim()) : (target_roles || ['all']);
    const fileUrl = `/uploads/training/${req.file.filename}`;

    const result = await query(
      `INSERT INTO training_materials (title, description, category, file_url, file_name, file_type, file_size, target_roles, required, sort_order, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        title,
        description || null,
        category || 'general',
        fileUrl,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        roles,
        required === 'true' || required === true,
        parseInt(sort_order) || 0,
        req.user!.userId,
      ]
    );

    res.status(201).json({ material: result.rows[0] });
  } catch (error) {
    console.error('Upload training material error:', error);
    res.status(500).json({ error: 'Failed to upload training material' });
  }
});

// ── Admin: update training material metadata ────────────────────────────
router.patch('/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { title, description, category, target_roles, required, sort_order } = req.body;
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (title !== undefined) { fields.push(`title = $${idx++}`); params.push(title); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); params.push(description); }
    if (category !== undefined) { fields.push(`category = $${idx++}`); params.push(category); }
    if (target_roles !== undefined) {
      fields.push(`target_roles = $${idx++}`);
      params.push(Array.isArray(target_roles) ? target_roles : target_roles.split(',').map((r: string) => r.trim()));
    }
    if (required !== undefined) { fields.push(`required = $${idx++}`); params.push(required); }
    if (sort_order !== undefined) { fields.push(`sort_order = $${idx++}`); params.push(sort_order); }

    fields.push(`updated_at = NOW()`);

    if (fields.length <= 1) { res.status(400).json({ error: 'No fields to update' }); return; }

    params.push(req.params.id);
    const result = await query(`UPDATE training_materials SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params);

    if (result.rows.length === 0) { res.status(404).json({ error: 'Material not found' }); return; }
    res.json({ material: result.rows[0] });
  } catch (error) {
    console.error('Update training material error:', error);
    res.status(500).json({ error: 'Failed to update training material' });
  }
});

// ── Admin: delete training material ─────────────────────────────────────
router.delete('/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const material = await query(`SELECT file_url FROM training_materials WHERE id = $1`, [req.params.id]);
    if (material.rows.length > 0 && material.rows[0].file_url) {
      const filePath = path.join(__dirname, '../..', material.rows[0].file_url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await query(`DELETE FROM training_materials WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete training material error:', error);
    res.status(500).json({ error: 'Failed to delete training material' });
  }
});

// ── Mark material as complete ───────────────────────────────────────────
router.post('/:id/complete', async (req: Request, res: Response) => {
  try {
    await query(
      `INSERT INTO training_completions (material_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.params.id, req.user!.userId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Complete training error:', error);
    res.status(500).json({ error: 'Failed to mark as complete' });
  }
});

// ── Unmark completion ───────────────────────────────────────────────────
router.delete('/:id/complete', async (req: Request, res: Response) => {
  try {
    await query(
      `DELETE FROM training_completions WHERE material_id = $1 AND user_id = $2`,
      [req.params.id, req.user!.userId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Uncomplete training error:', error);
    res.status(500).json({ error: 'Failed to unmark completion' });
  }
});

// ── Progress summary (for current user) ─────────────────────────────────
router.get('/progress', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;

    const total = await query(
      `SELECT COUNT(*) FROM training_materials WHERE $1 = ANY(target_roles) OR 'all' = ANY(target_roles)`,
      [role]
    );
    const completed = await query(
      `SELECT COUNT(*) FROM training_completions tc
       JOIN training_materials tm ON tm.id = tc.material_id
       WHERE tc.user_id = $1 AND ($2 = ANY(tm.target_roles) OR 'all' = ANY(tm.target_roles))`,
      [userId, role]
    );

    res.json({
      total: parseInt(total.rows[0].count),
      completed: parseInt(completed.rows[0].count),
    });
  } catch (error) {
    console.error('Progress error:', error);
    res.status(500).json({ error: 'Failed to get progress' });
  }
});

// ── Admin: completion report (all users) ────────────────────────────────
router.get('/report', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT u.id, u.first_name, u.last_name, u.role,
              (SELECT COUNT(*) FROM training_materials tm WHERE u.role = ANY(tm.target_roles) OR 'all' = ANY(tm.target_roles)) AS total,
              (SELECT COUNT(*) FROM training_completions tc
               JOIN training_materials tm ON tm.id = tc.material_id
               WHERE tc.user_id = u.id AND (u.role = ANY(tm.target_roles) OR 'all' = ANY(tm.target_roles))) AS completed
       FROM users u
       WHERE u.status = 'active' AND u.role != 'admin'
       ORDER BY u.first_name`
    );
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Training report error:', error);
    res.status(500).json({ error: 'Failed to get report' });
  }
});

// ── Course progress: save ─────────────────────────────────────────────
router.post('/course-progress', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { courseId, progress } = req.body;
    if (!courseId || !progress) return res.status(400).json({ error: 'courseId and progress required' });

    await query(
      `INSERT INTO training_course_progress (user_id, course_id, progress)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, course_id) DO UPDATE SET progress = $3, updated_at = NOW()`,
      [userId, courseId, JSON.stringify(progress)]
    );
    res.json({ ok: true });
  } catch (error) {
    console.error('Save course progress error:', error);
    res.status(500).json({ error: 'Failed to save progress' });
  }
});

// ── Course progress: load ─────────────────────────────────────────────
router.get('/course-progress/:courseId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const result = await query(
      `SELECT progress FROM training_course_progress WHERE user_id = $1 AND course_id = $2`,
      [userId, req.params.courseId]
    );
    res.json({ progress: result.rows[0]?.progress ?? null });
  } catch (error) {
    console.error('Load course progress error:', error);
    res.status(500).json({ error: 'Failed to load progress' });
  }
});

// ══════════════════════════════════════════════════════════════
// COURSE CRUD (admin manages interactive courses)
// ══════════════════════════════════════════════════════════════

router.get('/courses', async (req: Request, res: Response) => {
  try {
    const isAdmin = req.user!.role === 'admin';
    const sql = isAdmin
      ? `SELECT id, slug, title, description, target_roles, is_published, created_at, updated_at,
                jsonb_array_length(content) AS module_count
         FROM training_courses ORDER BY created_at`
      : `SELECT id, slug, title, description, target_roles, is_published, created_at,
                jsonb_array_length(content) AS module_count
         FROM training_courses
         WHERE is_published = TRUE AND ($1 = ANY(target_roles) OR 'all' = ANY(target_roles))
         ORDER BY created_at`;
    const params = isAdmin ? [] : [req.user!.role];
    const result = await query(sql, params);
    res.json({ courses: result.rows });
  } catch (error) {
    console.error('List courses error:', error);
    res.status(500).json({ error: 'Failed to list courses' });
  }
});

router.get('/courses/:slug', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM training_courses WHERE slug = $1`,
      [req.params.slug]
    );
    if (result.rows.length === 0) { res.status(404).json({ error: 'Course not found' }); return; }
    const course = result.rows[0];
    if (!course.is_published && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Course not published' });
      return;
    }
    res.json({ course });
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({ error: 'Failed to get course' });
  }
});

router.post('/courses', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { slug, title, description, target_roles, is_published, content } = req.body;
    if (!slug || !title) { res.status(400).json({ error: 'slug and title are required' }); return; }
    const result = await query(
      `INSERT INTO training_courses (slug, title, description, target_roles, is_published, content, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [slug, title, description || null, target_roles || ['all'], is_published ?? false, JSON.stringify(content || []), req.user!.userId]
    );
    res.status(201).json({ course: result.rows[0] });
  } catch (error: any) {
    if (error?.code === '23505') { res.status(409).json({ error: 'A course with that slug already exists' }); return; }
    console.error('Create course error:', error);
    res.status(500).json({ error: 'Failed to create course' });
  }
});

router.patch('/courses/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { slug, title, description, target_roles, is_published, content } = req.body;
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (slug !== undefined) { fields.push(`slug = $${idx++}`); params.push(slug); }
    if (title !== undefined) { fields.push(`title = $${idx++}`); params.push(title); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); params.push(description); }
    if (target_roles !== undefined) { fields.push(`target_roles = $${idx++}`); params.push(target_roles); }
    if (is_published !== undefined) { fields.push(`is_published = $${idx++}`); params.push(is_published); }
    if (content !== undefined) { fields.push(`content = $${idx++}`); params.push(JSON.stringify(content)); }
    fields.push(`updated_at = NOW()`);

    if (fields.length <= 1) { res.status(400).json({ error: 'No fields to update' }); return; }

    params.push(req.params.id);
    const result = await query(`UPDATE training_courses SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params);
    if (result.rows.length === 0) { res.status(404).json({ error: 'Course not found' }); return; }
    res.json({ course: result.rows[0] });
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({ error: 'Failed to update course' });
  }
});

router.delete('/courses/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    await query(`DELETE FROM training_courses WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

export default router;
