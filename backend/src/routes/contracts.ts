import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import {
  generateEmployeeAgreementPDF,
  generateNDAPDF,
  generateContractorAgreementPDF,
  generateServiceAgreementPDF,
  generateProposalPDF,
  generateContractPDF,
} from '../services/pdfGenerator';

const router = Router();
router.use(authenticateToken);

function slug(s: string) {
  return s.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
}

// ── Employee Agreement ──────────────────────────────────────────────────
router.post('/employee-agreement', async (req: Request, res: Response) => {
  try {
    const data = req.body;

    if (!data.employee_name || !data.role || !data.start_date) {
      res.status(400).json({ error: 'employee_name, role, and start_date are required' });
      return;
    }

    const doc = generateEmployeeAgreementPDF(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="employee-agreement-${slug(data.employee_name)}.pdf"`);
    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error('Generate employee agreement error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// ── NDA ─────────────────────────────────────────────────────────────────
router.post('/nda', async (req: Request, res: Response) => {
  try {
    const data = req.body;

    if (!data.party_name || !data.effective_date) {
      res.status(400).json({ error: 'party_name and effective_date are required' });
      return;
    }

    const doc = generateNDAPDF({ party_type: 'employee', ...data });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="nda-${slug(data.party_name)}.pdf"`);
    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error('Generate NDA error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// ── Independent Contractor Agreement ────────────────────────────────────
router.post('/contractor-agreement', async (req: Request, res: Response) => {
  try {
    const data = req.body;

    if (!data.contractor_name || !data.services_description || !data.compensation || !data.start_date) {
      res.status(400).json({ error: 'contractor_name, services_description, compensation, and start_date are required' });
      return;
    }

    const doc = generateContractorAgreementPDF(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="contractor-agreement-${slug(data.contractor_name)}.pdf"`);
    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error('Generate contractor agreement error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// ── Client Service Agreement (standalone) ───────────────────────────────
router.post('/service-agreement', async (req: Request, res: Response) => {
  try {
    const data = req.body;

    if (!data.client_company || !data.client_contact || !data.services || !data.total || !data.start_date) {
      res.status(400).json({ error: 'client_company, client_contact, services, total, and start_date are required' });
      return;
    }

    const doc = generateServiceAgreementPDF(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="service-agreement-${slug(data.client_company)}.pdf"`);
    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error('Generate service agreement error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// ── Client Proposal (standalone — not tied to a deal) ───────────────────
router.post('/client-proposal', async (req: Request, res: Response) => {
  try {
    const data = req.body;

    if (!data.company_name || !data.contact_name || !data.services || !data.total) {
      res.status(400).json({ error: 'company_name, contact_name, services, and total are required' });
      return;
    }

    const doc = generateProposalPDF(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="proposal-${slug(data.company_name)}.pdf"`);
    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error('Generate client proposal error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// ── General Contract (standalone — not tied to a deal) ──────────────────
router.post('/client-contract', async (req: Request, res: Response) => {
  try {
    const data = req.body;

    if (!data.company_name || !data.contact_name || !data.services || !data.total) {
      res.status(400).json({ error: 'company_name, contact_name, services, and total are required' });
      return;
    }

    const doc = generateContractPDF(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="contract-${slug(data.company_name)}.pdf"`);
    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error('Generate client contract error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

export default router;
