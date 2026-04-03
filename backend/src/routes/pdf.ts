import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken, requireRole } from '../middleware/auth';
import { generateProposalPDF, generateContractPDF } from '../services/pdfGenerator';

const router = Router();
router.use(authenticateToken);

// Generate proposal PDF for a deal
router.get('/proposal/:dealId', async (req: Request, res: Response) => {
  try {
    const dealResult = await query(
      `SELECT d.*, cu.first_name as closer_first, cu.last_name as closer_last
       FROM deals d LEFT JOIN users cu ON d.assigned_closer_id = cu.id
       WHERE d.id = $1`,
      [req.params.dealId]
    );
    if (dealResult.rows.length === 0) {
      res.status(404).json({ error: 'Deal not found' });
      return;
    }
    const deal = dealResult.rows[0];

    const services = [];
    if (deal.estimated_value) {
      services.push({ name: 'Project Services', price: parseFloat(deal.estimated_value) });
    }

    const customServices = req.query.services ? JSON.parse(req.query.services as string) : null;

    const doc = generateProposalPDF({
      company_name: deal.company_name,
      contact_name: deal.contact_name,
      contact_email: deal.contact_email,
      services: customServices || services,
      total: customServices
        ? customServices.reduce((sum: number, s: { price: number }) => sum + s.price, 0)
        : parseFloat(deal.estimated_value || '0'),
      timeline: deal.timeline,
      description: deal.pain_point,
      valid_until: deal.proposal_expires_at
        ? new Date(deal.proposal_expires_at).toLocaleDateString()
        : undefined,
      prepared_by: deal.closer_first
        ? `${deal.closer_first} ${deal.closer_last}`
        : undefined,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="proposal-${deal.company_name.replace(/\s+/g, '-').toLowerCase()}.pdf"`);
    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error('Generate proposal PDF error:', error);
    res.status(500).json({ error: 'Failed to generate proposal PDF' });
  }
});

// Generate contract PDF for a deal
router.get('/contract/:dealId', async (req: Request, res: Response) => {
  try {
    const dealResult = await query(
      `SELECT d.*, cu.first_name as closer_first, cu.last_name as closer_last
       FROM deals d LEFT JOIN users cu ON d.assigned_closer_id = cu.id
       WHERE d.id = $1`,
      [req.params.dealId]
    );
    if (dealResult.rows.length === 0) {
      res.status(404).json({ error: 'Deal not found' });
      return;
    }
    const deal = dealResult.rows[0];

    const services = [];
    if (deal.estimated_value) {
      services.push({ name: 'Project Services', price: parseFloat(deal.actual_value || deal.estimated_value) });
    }

    const doc = generateContractPDF({
      company_name: deal.company_name,
      contact_name: deal.contact_name,
      contact_email: deal.contact_email,
      services,
      total: parseFloat(deal.actual_value || deal.estimated_value || '0'),
      deposit_amount: deal.deposit_amount ? parseFloat(deal.deposit_amount) : undefined,
      payment_terms: deal.payment_terms,
      timeline: deal.timeline,
      start_date: deal.contract_signed_at
        ? new Date(deal.contract_signed_at).toLocaleDateString()
        : new Date().toLocaleDateString(),
      prepared_by: deal.closer_first
        ? `${deal.closer_first} ${deal.closer_last}`
        : undefined,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="contract-${deal.company_name.replace(/\s+/g, '-').toLowerCase()}.pdf"`);
    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error('Generate contract PDF error:', error);
    res.status(500).json({ error: 'Failed to generate contract PDF' });
  }
});

// Generate proposal from template
router.post('/proposal-from-template', requireRole('closer', 'admin'), async (req: Request, res: Response) => {
  try {
    const { deal_id, template_id } = req.body;

    const [dealResult, templateResult] = await Promise.all([
      query(
        `SELECT d.*, cu.first_name as closer_first, cu.last_name as closer_last
         FROM deals d LEFT JOIN users cu ON d.assigned_closer_id = cu.id
         WHERE d.id = $1`,
        [deal_id]
      ),
      query('SELECT * FROM proposal_templates WHERE id = $1', [template_id]),
    ]);

    if (dealResult.rows.length === 0) {
      res.status(404).json({ error: 'Deal not found' });
      return;
    }
    if (templateResult.rows.length === 0) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    const deal = dealResult.rows[0];
    const template = templateResult.rows[0];
    const services = typeof template.services === 'string' ? JSON.parse(template.services) : template.services;

    const doc = generateProposalPDF({
      company_name: deal.company_name,
      contact_name: deal.contact_name,
      contact_email: deal.contact_email,
      services,
      total: parseFloat(template.total),
      timeline: template.timeline || deal.timeline,
      description: template.description || deal.pain_point,
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      prepared_by: deal.closer_first
        ? `${deal.closer_first} ${deal.closer_last}`
        : undefined,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="proposal-${deal.company_name.replace(/\s+/g, '-').toLowerCase()}.pdf"`);
    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error('Generate template proposal PDF error:', error);
    res.status(500).json({ error: 'Failed to generate proposal PDF' });
  }
});

export default router;
