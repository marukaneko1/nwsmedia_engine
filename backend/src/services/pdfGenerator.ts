import PDFDocument from 'pdfkit';

/* ─── Shared helpers ──────────────────────────────────────────────────── */

function header(doc: PDFKit.PDFDocument) {
  doc.fontSize(24).fillColor('#1e40af').text('NWS MEDIA', { align: 'left' });
  doc.fontSize(10).fillColor('#6b7280').text('Digital Media & Web Solutions', { align: 'left' });
  doc.moveDown(2);
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.fontSize(14).fillColor('#111827').text(title);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').stroke();
  doc.moveDown(0.5);
}

function footer(doc: PDFKit.PDFDocument, text = 'NWS Media — Confidential') {
  doc.fontSize(9).fillColor('#9ca3af').text(text, 50, doc.page.height - 80, { align: 'center' });
}

function sigBlock(doc: PDFKit.PDFDocument, leftLabel: string, rightLabel: string) {
  doc.moveDown(2);
  const sigY = doc.y;
  doc.fontSize(12).fillColor('#111827');
  doc.text(leftLabel, 50, sigY);
  doc.text(rightLabel, 300, sigY);
  doc.moveDown(2.5);
  const lineY = doc.y;
  doc.moveTo(50, lineY).lineTo(250, lineY).strokeColor('#374151').stroke();
  doc.moveTo(300, lineY).lineTo(500, lineY).strokeColor('#374151').stroke();
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#6b7280');
  doc.text('Signature / Date', 50, doc.y);
  doc.text('Signature / Date', 300, doc.y - doc.currentLineHeight());
  doc.moveDown(2);
}

function bodyText(doc: PDFKit.PDFDocument, text: string) {
  doc.fontSize(11).fillColor('#374151').text(text, { lineGap: 3 });
}

function numberedList(doc: PDFKit.PDFDocument, items: string[]) {
  doc.fontSize(11).fillColor('#374151');
  items.forEach((item, i) => {
    doc.text(`${i + 1}. ${item}`, { indent: 10, lineGap: 2 });
  });
}

function bulletList(doc: PDFKit.PDFDocument, items: string[]) {
  doc.fontSize(11).fillColor('#374151');
  items.forEach((item) => {
    doc.text(`•  ${item}`, { indent: 10, lineGap: 2 });
  });
}

/* ─── Existing interfaces ─────────────────────────────────────────────── */

interface ProposalData {
  company_name: string;
  contact_name: string;
  contact_email?: string;
  services: { name: string; price: number }[];
  total: number;
  timeline?: string;
  description?: string;
  valid_until?: string;
  prepared_by?: string;
}

interface ContractData {
  company_name: string;
  contact_name: string;
  contact_email?: string;
  services: { name: string; price: number }[];
  total: number;
  deposit_amount?: number;
  payment_terms?: string;
  timeline?: string;
  start_date?: string;
  prepared_by?: string;
}

export function generateProposalPDF(data: ProposalData): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  // Header
  doc.fontSize(24).fillColor('#1e40af').text('NWS MEDIA', { align: 'left' });
  doc.fontSize(10).fillColor('#6b7280').text('Digital Media & Web Solutions', { align: 'left' });
  doc.moveDown(2);

  // Title
  doc.fontSize(20).fillColor('#111827').text('Proposal', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor('#6b7280').text(`Prepared for ${data.company_name}`, { align: 'center' });
  doc.moveDown(2);

  // Client Info
  doc.fontSize(14).fillColor('#111827').text('Client Information');
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').stroke();
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#374151');
  doc.text(`Company: ${data.company_name}`);
  doc.text(`Contact: ${data.contact_name}`);
  if (data.contact_email) doc.text(`Email: ${data.contact_email}`);
  doc.moveDown(1.5);

  if (data.description) {
    doc.fontSize(14).fillColor('#111827').text('Project Overview');
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').stroke();
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#374151').text(data.description);
    doc.moveDown(1.5);
  }

  // Services table
  doc.fontSize(14).fillColor('#111827').text('Proposed Services');
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').stroke();
  doc.moveDown(0.5);

  const tableTop = doc.y;
  doc.fontSize(10).fillColor('#6b7280');
  doc.text('Service', 50, tableTop, { width: 350 });
  doc.text('Price', 400, tableTop, { width: 145, align: 'right' });
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').stroke();
  doc.moveDown(0.3);

  doc.fontSize(11).fillColor('#374151');
  for (const service of data.services) {
    const y = doc.y;
    doc.text(service.name, 50, y, { width: 350 });
    doc.text(`$${service.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 400, y, { width: 145, align: 'right' });
    doc.moveDown(0.5);
  }

  doc.moveDown(0.5);
  doc.moveTo(300, doc.y).lineTo(545, doc.y).strokeColor('#111827').stroke();
  doc.moveDown(0.5);
  doc.fontSize(13).fillColor('#111827');
  const totalY = doc.y;
  doc.text('Total:', 300, totalY, { width: 100 });
  doc.text(`$${data.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 400, totalY, { width: 145, align: 'right' });
  doc.moveDown(2);

  if (data.timeline) {
    doc.fontSize(14).fillColor('#111827').text('Timeline');
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').stroke();
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#374151').text(data.timeline);
    doc.moveDown(1.5);
  }

  if (data.valid_until) {
    doc.fontSize(10).fillColor('#6b7280').text(`This proposal is valid until ${data.valid_until}.`, { align: 'center' });
    doc.moveDown(0.5);
  }

  doc.fontSize(9).fillColor('#9ca3af').text('NWS Media — Confidential', 50, doc.page.height - 80, { align: 'center' });
  if (data.prepared_by) {
    doc.text(`Prepared by: ${data.prepared_by}`, { align: 'center' });
  }

  return doc;
}

export function generateContractPDF(data: ContractData): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  // Header
  doc.fontSize(24).fillColor('#1e40af').text('NWS MEDIA', { align: 'left' });
  doc.fontSize(10).fillColor('#6b7280').text('Digital Media & Web Solutions', { align: 'left' });
  doc.moveDown(2);

  // Title
  doc.fontSize(20).fillColor('#111827').text('Service Agreement', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor('#6b7280').text(`Agreement with ${data.company_name}`, { align: 'center' });
  if (data.start_date) {
    doc.fontSize(10).fillColor('#9ca3af').text(`Effective Date: ${data.start_date}`, { align: 'center' });
  }
  doc.moveDown(2);

  // Parties
  doc.fontSize(14).fillColor('#111827').text('Parties');
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').stroke();
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#374151');
  doc.text('Provider: NWS Media ("Company")');
  doc.text(`Client: ${data.company_name} ("Client")`);
  doc.text(`Contact: ${data.contact_name}`);
  if (data.contact_email) doc.text(`Email: ${data.contact_email}`);
  doc.moveDown(1.5);

  // Scope of Work
  doc.fontSize(14).fillColor('#111827').text('Scope of Work');
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').stroke();
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#374151');
  for (const service of data.services) {
    doc.text(`• ${service.name} — $${service.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  }
  doc.moveDown(1);
  doc.fontSize(12).fillColor('#111827').text(`Total Project Cost: $${data.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  doc.moveDown(1.5);

  // Payment terms
  doc.fontSize(14).fillColor('#111827').text('Payment Terms');
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').stroke();
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#374151');
  if (data.deposit_amount) {
    doc.text(`Deposit Required: $${data.deposit_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} (due upon signing)`);
  }
  if (data.payment_terms) {
    doc.text(`Terms: ${data.payment_terms}`);
  } else {
    doc.text('Balance due upon project completion.');
  }
  doc.moveDown(1.5);

  if (data.timeline) {
    doc.fontSize(14).fillColor('#111827').text('Project Timeline');
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').stroke();
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#374151').text(data.timeline);
    doc.moveDown(1.5);
  }

  // Terms & Conditions
  doc.fontSize(14).fillColor('#111827').text('Terms & Conditions');
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').stroke();
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#374151');
  doc.text('1. Client agrees to provide timely feedback and necessary materials for project completion.');
  doc.text('2. Project timeline begins upon receipt of deposit payment.');
  doc.text('3. Revisions beyond the agreed scope may incur additional charges.');
  doc.text('4. Final payment is due upon delivery of completed work.');
  doc.text('5. Either party may terminate this agreement with 30 days written notice.');
  doc.moveDown(2);

  // Signature lines
  doc.fontSize(12).fillColor('#111827').text('Signatures');
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').stroke();
  doc.moveDown(2);

  const sigY = doc.y;
  doc.text('NWS Media', 50, sigY);
  doc.text(data.company_name, 300, sigY);
  doc.moveDown(2.5);
  const lineY = doc.y;
  doc.moveTo(50, lineY).lineTo(250, lineY).strokeColor('#374151').stroke();
  doc.moveTo(300, lineY).lineTo(500, lineY).strokeColor('#374151').stroke();
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#6b7280');
  doc.text('Signature / Date', 50, doc.y);
  doc.text('Signature / Date', 300, doc.y - doc.currentLineHeight());
  doc.moveDown(2);

  doc.fontSize(9).fillColor('#9ca3af').text('NWS Media — Confidential', 50, doc.page.height - 80, { align: 'center' });

  return doc;
}

/* ═══════════════════════════════════════════════════════════════════════
   EMPLOYEE AGREEMENT
   ═══════════════════════════════════════════════════════════════════════ */

export interface EmployeeAgreementData {
  employee_name: string;
  employee_email?: string;
  role: string;
  start_date: string;
  compensation?: string;
  schedule?: string;
  commission_structure?: string;
  probation_period?: string;
  termination_notice?: string;
  prepared_by?: string;
}

export function generateEmployeeAgreementPDF(data: EmployeeAgreementData): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  header(doc);

  doc.fontSize(20).fillColor('#111827').text('Employment Agreement', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#6b7280').text(`Effective Date: ${data.start_date}`, { align: 'center' });
  doc.moveDown(2);

  sectionTitle(doc, '1. Parties');
  bodyText(doc, 'This Employment Agreement ("Agreement") is entered into between:');
  doc.moveDown(0.5);
  bodyText(doc, 'Employer: NWS Media LLC ("Company")');
  bodyText(doc, `Employee: ${data.employee_name} ("Employee")`);
  if (data.employee_email) bodyText(doc, `Email: ${data.employee_email}`);
  doc.moveDown(1);

  sectionTitle(doc, '2. Position & Duties');
  bodyText(doc, `The Employee is hired for the position of ${data.role}. The Employee agrees to perform all duties and responsibilities associated with this role as directed by the Company. Key responsibilities include:`);
  doc.moveDown(0.5);

  const roleDuties: Record<string, string[]> = {
    'VA (Cold Caller)': [
      'Conduct outbound cold calls to prospective leads',
      'Qualify leads using the Company\'s ICP scoring framework',
      'Schedule appointments and hand off qualified leads to closers',
      'Maintain accurate records in the CRM system',
      'Meet daily and weekly call volume targets',
    ],
    'Closer': [
      'Convert qualified leads into paying clients',
      'Conduct discovery calls and needs assessments',
      'Prepare and present proposals to prospective clients',
      'Negotiate contract terms and close deals',
      'Maintain an accurate pipeline in the CRM system',
    ],
    'Operations': [
      'Manage client projects from handoff through delivery',
      'Coordinate with team members and clients on project milestones',
      'Ensure projects are completed on time and within scope',
      'Maintain project documentation and status updates',
      'Communicate project progress to clients via the CRM portal',
    ],
  };
  bulletList(doc, roleDuties[data.role] || ['Perform duties as assigned by management']);
  doc.moveDown(1);

  sectionTitle(doc, '3. Compensation');
  if (data.compensation) {
    bodyText(doc, data.compensation);
  } else {
    bodyText(doc, 'Compensation will be discussed and agreed upon separately. The Employee may be eligible for commissions as outlined below.');
  }
  doc.moveDown(0.5);
  if (data.commission_structure) {
    bodyText(doc, `Commission Structure: ${data.commission_structure}`);
  } else {
    bodyText(doc, 'Commission rates are based on role and performance metrics as defined in the Company\'s commission policy.');
  }
  doc.moveDown(1);

  sectionTitle(doc, '4. Work Schedule');
  bodyText(doc, data.schedule || 'The Employee\'s work schedule will be determined in coordination with management. Standard working hours and days will be set during onboarding.');
  doc.moveDown(1);

  sectionTitle(doc, '5. Probationary Period');
  bodyText(doc, `The first ${data.probation_period || '90 days'} of employment shall be a probationary period during which either party may terminate this agreement with minimal notice. During this period, the Employee\'s performance will be evaluated.`);
  doc.moveDown(1);

  sectionTitle(doc, '6. Confidentiality');
  bodyText(doc, 'The Employee agrees to maintain the confidentiality of all proprietary information, client data, business strategies, pricing structures, and trade secrets of the Company. This obligation survives the termination of this Agreement.');
  doc.moveDown(1);

  sectionTitle(doc, '7. Non-Compete & Non-Solicitation');
  bodyText(doc, 'During employment and for a period of 12 months following termination, the Employee agrees not to:');
  doc.moveDown(0.3);
  bulletList(doc, [
    'Directly compete with the Company in the same market or service area',
    'Solicit or contact the Company\'s clients for competing services',
    'Recruit or hire the Company\'s employees or contractors',
  ]);
  doc.moveDown(1);

  doc.addPage();
  header(doc);

  sectionTitle(doc, '8. Intellectual Property');
  bodyText(doc, 'All work product, materials, and intellectual property created by the Employee during the course of employment shall be the sole property of the Company.');
  doc.moveDown(1);

  sectionTitle(doc, '9. Termination');
  bodyText(doc, `Either party may terminate this Agreement with ${data.termination_notice || '14 days'} written notice. The Company reserves the right to terminate immediately for cause, including but not limited to violation of company policies, misconduct, or material breach of this Agreement.`);
  doc.moveDown(1);

  sectionTitle(doc, '10. At-Will Employment');
  bodyText(doc, 'This is an at-will employment agreement. Nothing in this Agreement guarantees employment for any specific duration. Either party may end the employment relationship at any time, with or without cause, subject to the notice requirements above.');
  doc.moveDown(1);

  sectionTitle(doc, '11. Governing Law');
  bodyText(doc, 'This Agreement shall be governed by and construed in accordance with the laws of the State of New York.');
  doc.moveDown(1);

  sectionTitle(doc, '12. Entire Agreement');
  bodyText(doc, 'This Agreement constitutes the entire understanding between the parties and supersedes all prior agreements, representations, and understandings.');
  doc.moveDown(1.5);

  sigBlock(doc, 'NWS Media LLC', data.employee_name);
  footer(doc);

  return doc;
}

/* ═══════════════════════════════════════════════════════════════════════
   NON-DISCLOSURE AGREEMENT (NDA)
   ═══════════════════════════════════════════════════════════════════════ */

export interface NDAData {
  party_name: string;
  party_email?: string;
  party_type: 'employee' | 'contractor' | 'client' | 'partner';
  effective_date: string;
  duration?: string;
  prepared_by?: string;
}

export function generateNDAPDF(data: NDAData): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  header(doc);

  doc.fontSize(20).fillColor('#111827').text('Non-Disclosure Agreement', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#6b7280').text(`Effective Date: ${data.effective_date}`, { align: 'center' });
  doc.moveDown(2);

  sectionTitle(doc, '1. Parties');
  bodyText(doc, 'This Non-Disclosure Agreement ("Agreement") is entered into between:');
  doc.moveDown(0.5);
  bodyText(doc, 'Disclosing Party: NWS Media LLC ("Company")');
  bodyText(doc, `Receiving Party: ${data.party_name} ("${data.party_type.charAt(0).toUpperCase() + data.party_type.slice(1)}")`);
  if (data.party_email) bodyText(doc, `Email: ${data.party_email}`);
  doc.moveDown(1);

  sectionTitle(doc, '2. Purpose');
  bodyText(doc, 'The purpose of this Agreement is to protect confidential information that may be disclosed between the parties in connection with business discussions, employment, contracting, or partnership activities related to the Company\'s digital media and web solutions services.');
  doc.moveDown(1);

  sectionTitle(doc, '3. Definition of Confidential Information');
  bodyText(doc, '"Confidential Information" includes, but is not limited to:');
  doc.moveDown(0.3);
  bulletList(doc, [
    'Client lists, contact information, and project details',
    'Pricing structures, commission rates, and financial data',
    'Business strategies, marketing plans, and sales processes',
    'Proprietary software, tools, CRM data, and technical documentation',
    'Trade secrets, workflows, and operational procedures',
    'Any information marked as confidential or that a reasonable person would consider confidential',
  ]);
  doc.moveDown(1);

  sectionTitle(doc, '4. Obligations of the Receiving Party');
  bodyText(doc, 'The Receiving Party agrees to:');
  doc.moveDown(0.3);
  numberedList(doc, [
    'Hold all Confidential Information in strict confidence',
    'Not disclose Confidential Information to any third party without prior written consent',
    'Use Confidential Information solely for the purposes outlined in this Agreement',
    'Take all reasonable measures to protect the confidentiality of the information',
    'Notify the Company immediately upon discovery of any unauthorized disclosure',
  ]);
  doc.moveDown(1);

  sectionTitle(doc, '5. Exclusions');
  bodyText(doc, 'Confidential Information does not include information that:');
  doc.moveDown(0.3);
  bulletList(doc, [
    'Is or becomes publicly available through no fault of the Receiving Party',
    'Was known to the Receiving Party prior to disclosure',
    'Is independently developed by the Receiving Party without use of Confidential Information',
    'Is required to be disclosed by law or court order (with prompt notice to the Company)',
  ]);
  doc.moveDown(1);

  sectionTitle(doc, '6. Duration');
  bodyText(doc, `This Agreement shall remain in effect for ${data.duration || '2 years'} from the Effective Date. The obligations of confidentiality shall survive the termination of this Agreement.`);
  doc.moveDown(1);

  sectionTitle(doc, '7. Remedies');
  bodyText(doc, 'The Receiving Party acknowledges that unauthorized disclosure of Confidential Information may cause irreparable harm. The Company shall be entitled to seek injunctive relief in addition to any other remedies available at law.');
  doc.moveDown(1);

  sectionTitle(doc, '8. Governing Law');
  bodyText(doc, 'This Agreement shall be governed by the laws of the State of New York.');
  doc.moveDown(1.5);

  sigBlock(doc, 'NWS Media LLC', data.party_name);
  footer(doc);

  return doc;
}

/* ═══════════════════════════════════════════════════════════════════════
   INDEPENDENT CONTRACTOR AGREEMENT
   ═══════════════════════════════════════════════════════════════════════ */

export interface ContractorAgreementData {
  contractor_name: string;
  contractor_email?: string;
  services_description: string;
  compensation: string;
  start_date: string;
  end_date?: string;
  payment_terms?: string;
  prepared_by?: string;
}

export function generateContractorAgreementPDF(data: ContractorAgreementData): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  header(doc);

  doc.fontSize(20).fillColor('#111827').text('Independent Contractor Agreement', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#6b7280').text(`Effective Date: ${data.start_date}`, { align: 'center' });
  doc.moveDown(2);

  sectionTitle(doc, '1. Parties');
  bodyText(doc, 'This Independent Contractor Agreement ("Agreement") is entered into between:');
  doc.moveDown(0.5);
  bodyText(doc, 'Client: NWS Media LLC ("Company")');
  bodyText(doc, `Contractor: ${data.contractor_name} ("Contractor")`);
  if (data.contractor_email) bodyText(doc, `Email: ${data.contractor_email}`);
  doc.moveDown(1);

  sectionTitle(doc, '2. Scope of Services');
  bodyText(doc, 'The Contractor agrees to perform the following services:');
  doc.moveDown(0.5);
  bodyText(doc, data.services_description);
  doc.moveDown(1);

  sectionTitle(doc, '3. Compensation');
  bodyText(doc, data.compensation);
  doc.moveDown(0.5);
  bodyText(doc, `Payment Terms: ${data.payment_terms || 'Net 15 — invoices are due within 15 days of receipt.'}`);
  doc.moveDown(1);

  sectionTitle(doc, '4. Term');
  if (data.end_date) {
    bodyText(doc, `This Agreement begins on ${data.start_date} and ends on ${data.end_date}, unless terminated earlier in accordance with Section 8.`);
  } else {
    bodyText(doc, `This Agreement begins on ${data.start_date} and continues until terminated by either party in accordance with Section 8.`);
  }
  doc.moveDown(1);

  sectionTitle(doc, '5. Independent Contractor Status');
  bodyText(doc, 'The Contractor is an independent contractor and not an employee, partner, or agent of the Company. The Contractor is responsible for their own taxes, insurance, and benefits. The Contractor has the right to control the manner and means of performing the services.');
  doc.moveDown(1);

  sectionTitle(doc, '6. Confidentiality');
  bodyText(doc, 'The Contractor agrees to maintain the confidentiality of all proprietary information, client data, and trade secrets of the Company. This obligation survives termination of this Agreement.');
  doc.moveDown(1);

  sectionTitle(doc, '7. Intellectual Property');
  bodyText(doc, 'All work product created by the Contractor under this Agreement shall be considered "work made for hire" and shall be the exclusive property of the Company. The Contractor hereby assigns all rights, title, and interest in such work product to the Company.');
  doc.moveDown(1);

  sectionTitle(doc, '8. Termination');
  bodyText(doc, 'Either party may terminate this Agreement with 14 days written notice. The Company shall pay the Contractor for all work completed up to the effective date of termination.');
  doc.moveDown(1);

  sectionTitle(doc, '9. Indemnification');
  bodyText(doc, 'The Contractor agrees to indemnify and hold harmless the Company from any claims arising from the Contractor\'s performance of services under this Agreement.');
  doc.moveDown(1);

  sectionTitle(doc, '10. Governing Law');
  bodyText(doc, 'This Agreement shall be governed by the laws of the State of New York.');
  doc.moveDown(1.5);

  sigBlock(doc, 'NWS Media LLC', data.contractor_name);
  footer(doc);

  return doc;
}

/* ═══════════════════════════════════════════════════════════════════════
   CLIENT SERVICE AGREEMENT (Standalone — not tied to a deal)
   ═══════════════════════════════════════════════════════════════════════ */

export interface ServiceAgreementData {
  client_company: string;
  client_contact: string;
  client_email?: string;
  services: { name: string; price: number }[];
  total: number;
  deposit_percentage?: number;
  timeline?: string;
  start_date: string;
  revisions?: number;
  payment_terms?: string;
  prepared_by?: string;
}

export function generateServiceAgreementPDF(data: ServiceAgreementData): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  header(doc);

  doc.fontSize(20).fillColor('#111827').text('Client Service Agreement', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#6b7280').text(`Prepared for ${data.client_company}`, { align: 'center' });
  doc.fontSize(10).fillColor('#9ca3af').text(`Date: ${data.start_date}`, { align: 'center' });
  doc.moveDown(2);

  sectionTitle(doc, '1. Parties');
  bodyText(doc, 'Provider: NWS Media LLC ("Company")');
  bodyText(doc, `Client: ${data.client_company} ("Client")`);
  bodyText(doc, `Contact: ${data.client_contact}`);
  if (data.client_email) bodyText(doc, `Email: ${data.client_email}`);
  doc.moveDown(1);

  sectionTitle(doc, '2. Scope of Services');
  doc.fontSize(11).fillColor('#374151');
  const tableTop = doc.y;
  doc.fontSize(10).fillColor('#6b7280');
  doc.text('Service', 50, tableTop, { width: 350 });
  doc.text('Price', 400, tableTop, { width: 145, align: 'right' });
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').stroke();
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor('#374151');
  for (const svc of data.services) {
    const y = doc.y;
    doc.text(svc.name, 50, y, { width: 350 });
    doc.text(`$${svc.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 400, y, { width: 145, align: 'right' });
    doc.moveDown(0.5);
  }
  doc.moveDown(0.5);
  doc.moveTo(300, doc.y).lineTo(545, doc.y).strokeColor('#111827').stroke();
  doc.moveDown(0.5);
  doc.fontSize(13).fillColor('#111827');
  const totalY = doc.y;
  doc.text('Total:', 300, totalY, { width: 100 });
  doc.text(`$${data.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 400, totalY, { width: 145, align: 'right' });
  doc.moveDown(1.5);

  sectionTitle(doc, '3. Payment Terms');
  const depositPct = data.deposit_percentage || 50;
  const depositAmt = data.total * (depositPct / 100);
  bodyText(doc, `A deposit of ${depositPct}% ($${depositAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}) is required before work begins.`);
  bodyText(doc, data.payment_terms || 'The remaining balance is due upon project completion and delivery.');
  doc.moveDown(1);

  if (data.timeline) {
    sectionTitle(doc, '4. Project Timeline');
    bodyText(doc, `Estimated timeline: ${data.timeline}. Timeline begins upon receipt of deposit and all required materials from the Client.`);
    doc.moveDown(1);
  }

  sectionTitle(doc, data.timeline ? '5. Revisions' : '4. Revisions');
  bodyText(doc, `This agreement includes up to ${data.revisions || 3} rounds of revisions. Additional revisions may be subject to additional charges at the Company's standard hourly rate.`);
  doc.moveDown(1);

  sectionTitle(doc, data.timeline ? '6. Client Responsibilities' : '5. Client Responsibilities');
  bodyText(doc, 'The Client agrees to:');
  doc.moveDown(0.3);
  numberedList(doc, [
    'Provide all necessary content, assets, and information in a timely manner',
    'Designate a single point of contact for feedback and approvals',
    'Respond to requests for feedback within 5 business days',
    'Pay all invoices according to the terms of this Agreement',
  ]);
  doc.moveDown(1);

  sectionTitle(doc, data.timeline ? '7. Cancellation & Refunds' : '6. Cancellation & Refunds');
  bodyText(doc, 'If the Client cancels the project after work has begun, the deposit is non-refundable. Any work completed beyond the deposit amount will be billed and due within 15 days of cancellation.');
  doc.moveDown(1);

  sectionTitle(doc, data.timeline ? '8. Governing Law' : '7. Governing Law');
  bodyText(doc, 'This Agreement shall be governed by the laws of the State of New York.');
  doc.moveDown(1.5);

  sigBlock(doc, 'NWS Media LLC', data.client_company);
  footer(doc);

  return doc;
}

