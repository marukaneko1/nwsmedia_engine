import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { env } from '../config/env';

const router = Router();

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ── Authenticated routes ────────────────────────────────────────────────

router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const isAdmin = req.user!.role === 'admin';
    const sql = isAdmin
      ? `SELECT d.*, u.first_name || ' ' || u.last_name AS created_by_name,
                (SELECT COUNT(*) FROM document_signers ds WHERE ds.document_id = d.id) AS signer_count,
                (SELECT COUNT(*) FROM document_signers ds WHERE ds.document_id = d.id AND ds.status = 'signed') AS signed_count
         FROM documents d
         LEFT JOIN users u ON u.id = d.created_by_id
         ORDER BY d.created_at DESC`
      : `SELECT d.*, u.first_name || ' ' || u.last_name AS created_by_name,
                (SELECT COUNT(*) FROM document_signers ds WHERE ds.document_id = d.id) AS signer_count,
                (SELECT COUNT(*) FROM document_signers ds WHERE ds.document_id = d.id AND ds.status = 'signed') AS signed_count
         FROM documents d
         LEFT JOIN users u ON u.id = d.created_by_id
         WHERE d.created_by_id = $1
         ORDER BY d.created_at DESC`;
    const params = isAdmin ? [] : [req.user!.userId];
    const result = await query(sql, params);
    res.json({ documents: result.rows });
  } catch (err) {
    console.error('List documents error:', err);
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const doc = await query(`SELECT * FROM documents WHERE id = $1`, [req.params.id]);
    if (doc.rows.length === 0) { res.status(404).json({ error: 'Document not found' }); return; }

    const signers = await query(
      `SELECT id, name, email, role, order_num, status, signed_at, viewed_at FROM document_signers WHERE document_id = $1 ORDER BY order_num`,
      [req.params.id]
    );
    const fields = await query(
      `SELECT * FROM document_fields WHERE document_id = $1 ORDER BY page, y`,
      [req.params.id]
    );
    const audit = await query(
      `SELECT * FROM document_audit_log WHERE document_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.params.id]
    );

    res.json({
      document: doc.rows[0],
      signers: signers.rows,
      fields: fields.rows,
      audit: audit.rows,
    });
  } catch (err) {
    console.error('Get document error:', err);
    res.status(500).json({ error: 'Failed to get document' });
  }
});

router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { title, type, content, client_name, client_email, deal_id, expires_at } = req.body;
    if (!title) { res.status(400).json({ error: 'title is required' }); return; }

    const result = await query(
      `INSERT INTO documents (title, type, content, client_name, client_email, deal_id, expires_at, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [title, type || 'contract', JSON.stringify(content || {}), client_name || null, client_email || null, deal_id || null, expires_at || null, req.user!.userId]
    );

    await query(
      `INSERT INTO document_audit_log (document_id, action, actor_name, actor_email, details)
       VALUES ($1, 'created', $2, $3, 'Document created')`,
      [result.rows[0].id, `${req.user!.userId}`, req.user!.email]
    );

    res.status(201).json({ document: result.rows[0] });
  } catch (err) {
    console.error('Create document error:', err);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

router.patch('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { title, type, content, status, client_name, client_email, expires_at } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (title !== undefined) { updates.push(`title = $${idx++}`); params.push(title); }
    if (type !== undefined) { updates.push(`type = $${idx++}`); params.push(type); }
    if (content !== undefined) { updates.push(`content = $${idx++}`); params.push(JSON.stringify(content)); }
    if (status !== undefined) { updates.push(`status = $${idx++}`); params.push(status); }
    if (client_name !== undefined) { updates.push(`client_name = $${idx++}`); params.push(client_name); }
    if (client_email !== undefined) { updates.push(`client_email = $${idx++}`); params.push(client_email); }
    if (expires_at !== undefined) { updates.push(`expires_at = $${idx++}`); params.push(expires_at); }

    if (updates.length === 0) { res.json({ success: true }); return; }
    updates.push(`updated_at = NOW()`);
    params.push(req.params.id);

    await query(`UPDATE documents SET ${updates.join(', ')} WHERE id = $${idx}`, params);
    res.json({ success: true });
  } catch (err) {
    console.error('Update document error:', err);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    await query(`DELETE FROM documents WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete document error:', err);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// ── Signers CRUD ────────────────────────────────────────────────────────

router.post('/:id/signers', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { name, email, role, order_num } = req.body;
    if (!name || !email) { res.status(400).json({ error: 'name and email required' }); return; }

    const token = generateToken();
    const result = await query(
      `INSERT INTO document_signers (document_id, name, email, role, order_num, token)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, order_num, status`,
      [req.params.id, name, email, role || 'signer', order_num || 1, token]
    );

    res.status(201).json({ signer: result.rows[0] });
  } catch (err) {
    console.error('Add signer error:', err);
    res.status(500).json({ error: 'Failed to add signer' });
  }
});

router.delete('/:id/signers/:signerId', authenticateToken, async (req: Request, res: Response) => {
  try {
    await query(`DELETE FROM document_signers WHERE id = $1 AND document_id = $2`, [req.params.signerId, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Remove signer error:', err);
    res.status(500).json({ error: 'Failed to remove signer' });
  }
});

// ── Fields CRUD ─────────────────────────────────────────────────────────

router.post('/:id/fields', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { fields } = req.body;
    if (!Array.isArray(fields)) { res.status(400).json({ error: 'fields array required' }); return; }

    await query(`DELETE FROM document_fields WHERE document_id = $1`, [req.params.id]);

    for (const f of fields) {
      await query(
        `INSERT INTO document_fields (document_id, signer_id, type, label, page, x, y, width, height, required)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [req.params.id, f.signer_id || null, f.type, f.label || null, f.page || 1, f.x, f.y, f.width || 200, f.height || 50, f.required ?? true]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Save fields error:', err);
    res.status(500).json({ error: 'Failed to save fields' });
  }
});

// ── Send for signature ──────────────────────────────────────────────────

router.post('/:id/send', authenticateToken, async (req: Request, res: Response) => {
  try {
    const docResult = await query(`SELECT * FROM documents WHERE id = $1`, [req.params.id]);
    if (docResult.rows.length === 0) { res.status(404).json({ error: 'Document not found' }); return; }

    const signers = await query(
      `SELECT * FROM document_signers WHERE document_id = $1 ORDER BY order_num`,
      [req.params.id]
    );
    if (signers.rows.length === 0) { res.status(400).json({ error: 'Add at least one signer' }); return; }

    await query(`UPDATE documents SET status = 'sent', updated_at = NOW() WHERE id = $1`, [req.params.id]);
    await query(`UPDATE document_signers SET status = 'sent' WHERE document_id = $1`, [req.params.id]);

    await query(
      `INSERT INTO document_audit_log (document_id, action, actor_email, details)
       VALUES ($1, 'sent', $2, $3)`,
      [req.params.id, req.user!.email, `Sent to ${signers.rows.map((s: any) => s.email).join(', ')}`]
    );

    const links = signers.rows.map((s: any) => ({
      name: s.name,
      email: s.email,
      signing_url: `${env.FRONTEND_URL}/sign/${s.token}`,
    }));

    res.json({ success: true, links });
  } catch (err) {
    console.error('Send document error:', err);
    res.status(500).json({ error: 'Failed to send document' });
  }
});

// ── Public signing routes (no auth) ─────────────────────────────────────

router.get('/sign/:token', async (req: Request, res: Response) => {
  try {
    const signer = await query(
      `SELECT ds.*, d.title, d.type, d.content, d.status AS doc_status, d.expires_at,
              d.created_by_id, u.first_name || ' ' || u.last_name AS sender_name
       FROM document_signers ds
       JOIN documents d ON d.id = ds.document_id
       LEFT JOIN users u ON u.id = d.created_by_id
       WHERE ds.token = $1`,
      [req.params.token]
    );

    if (signer.rows.length === 0) { res.status(404).json({ error: 'Invalid signing link' }); return; }

    const row = signer.rows[0];

    if (row.doc_status === 'voided') { res.status(410).json({ error: 'This document has been voided' }); return; }
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      res.status(410).json({ error: 'This signing link has expired' });
      return;
    }

    if (!row.viewed_at) {
      await query(`UPDATE document_signers SET viewed_at = NOW(), status = 'viewed' WHERE id = $1`, [row.id]);
      await query(
        `INSERT INTO document_audit_log (document_id, action, actor_name, actor_email, ip_address, details)
         VALUES ($1, 'viewed', $2, $3, $4, 'Document viewed by signer')`,
        [row.document_id, row.name, row.email, req.ip]
      );

      const allViewed = await query(
        `SELECT COUNT(*) as total, COUNT(viewed_at) as viewed FROM document_signers WHERE document_id = $1`,
        [row.document_id]
      );
      if (parseInt(allViewed.rows[0].total) === parseInt(allViewed.rows[0].viewed)) {
        await query(`UPDATE documents SET status = 'viewed' WHERE id = $1 AND status = 'sent'`, [row.document_id]);
      }
    }

    const fields = await query(
      `SELECT * FROM document_fields WHERE document_id = $1 AND (signer_id = $2 OR signer_id IS NULL) ORDER BY page, y`,
      [row.document_id, row.id]
    );

    res.json({
      document: {
        title: row.title,
        type: row.type,
        content: row.content,
        sender_name: row.sender_name,
      },
      signer: {
        id: row.id,
        name: row.name,
        email: row.email,
        status: row.status,
        signed_at: row.signed_at,
      },
      fields: fields.rows,
    });
  } catch (err) {
    console.error('Get signing page error:', err);
    res.status(500).json({ error: 'Failed to load document' });
  }
});

router.post('/sign/:token', async (req: Request, res: Response) => {
  try {
    const { signature_data, field_values } = req.body;

    const signer = await query(
      `SELECT ds.*, d.id AS doc_id FROM document_signers ds
       JOIN documents d ON d.id = ds.document_id
       WHERE ds.token = $1`,
      [req.params.token]
    );
    if (signer.rows.length === 0) { res.status(404).json({ error: 'Invalid signing link' }); return; }

    const row = signer.rows[0];
    if (row.status === 'signed') { res.status(400).json({ error: 'Already signed' }); return; }

    await query(
      `UPDATE document_signers SET status = 'signed', signature_data = $1, signed_at = NOW(), ip_address = $2 WHERE id = $3`,
      [signature_data, req.ip, row.id]
    );

    if (field_values && typeof field_values === 'object') {
      for (const [fieldId, value] of Object.entries(field_values)) {
        await query(
          `UPDATE document_fields SET value = $1, filled_at = NOW() WHERE id = $2`,
          [value as string, fieldId]
        );
      }
    }

    await query(
      `INSERT INTO document_audit_log (document_id, action, actor_name, actor_email, ip_address, details)
       VALUES ($1, 'signed', $2, $3, $4, 'Document signed')`,
      [row.doc_id, row.name, row.email, req.ip]
    );

    const allSigned = await query(
      `SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'signed' THEN 1 END) as signed FROM document_signers WHERE document_id = $1`,
      [row.doc_id]
    );
    const total = parseInt(allSigned.rows[0].total);
    const signed = parseInt(allSigned.rows[0].signed);

    if (signed === total) {
      await query(`UPDATE documents SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1`, [row.doc_id]);
    } else if (signed > 0) {
      await query(`UPDATE documents SET status = 'partially_signed', updated_at = NOW() WHERE id = $1`, [row.doc_id]);
    }

    res.json({ success: true, all_signed: signed === total });
  } catch (err) {
    console.error('Sign document error:', err);
    res.status(500).json({ error: 'Failed to sign document' });
  }
});

router.post('/sign/:token/decline', async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const signer = await query(
      `SELECT ds.*, d.id AS doc_id FROM document_signers ds JOIN documents d ON d.id = ds.document_id WHERE ds.token = $1`,
      [req.params.token]
    );
    if (signer.rows.length === 0) { res.status(404).json({ error: 'Invalid signing link' }); return; }

    const row = signer.rows[0];
    await query(`UPDATE document_signers SET status = 'declined' WHERE id = $1`, [row.id]);
    await query(`UPDATE documents SET status = 'declined', updated_at = NOW() WHERE id = $1`, [row.doc_id]);
    await query(
      `INSERT INTO document_audit_log (document_id, action, actor_name, actor_email, ip_address, details)
       VALUES ($1, 'declined', $2, $3, $4, $5)`,
      [row.doc_id, row.name, row.email, req.ip, reason || 'Signer declined']
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Decline document error:', err);
    res.status(500).json({ error: 'Failed to decline' });
  }
});

export default router;
