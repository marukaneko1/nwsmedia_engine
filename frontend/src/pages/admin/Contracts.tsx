import { useState, FormEvent } from 'react';
import { useApiQuery } from '../../hooks/useApiQuery';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';

type TemplateKey =
  | 'employee-agreement'
  | 'nda'
  | 'contractor-agreement'
  | 'service-agreement'
  | 'client-proposal'
  | 'client-contract';

interface TemplateInfo {
  key: TemplateKey;
  title: string;
  description: string;
  category: 'employee' | 'client' | 'legal';
  icon: string;
  badgeColor: 'blue' | 'green' | 'purple';
}

const TEMPLATES: TemplateInfo[] = [
  {
    key: 'employee-agreement',
    title: 'Employee Agreement',
    description: 'Standard employment contract with role-specific duties, compensation, non-compete, confidentiality, and termination clauses.',
    category: 'employee',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    badgeColor: 'blue',
  },
  {
    key: 'nda',
    title: 'Non-Disclosure Agreement',
    description: 'Protects confidential business information. Covers client data, pricing, strategies, and trade secrets.',
    category: 'legal',
    icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
    badgeColor: 'purple',
  },
  {
    key: 'contractor-agreement',
    title: 'Contractor Agreement',
    description: 'Independent contractor terms including scope of work, compensation, IP assignment, and termination provisions.',
    category: 'employee',
    icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2M3.75 12.75h16.5',
    badgeColor: 'blue',
  },
  {
    key: 'service-agreement',
    title: 'Client Service Agreement',
    description: 'Full service contract with itemized services, payment terms, timeline, revisions, and cancellation policy.',
    category: 'client',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    badgeColor: 'green',
  },
  {
    key: 'client-proposal',
    title: 'Business Proposal',
    description: 'Professional proposal document with services breakdown, pricing, timeline, and project overview.',
    category: 'client',
    icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
    badgeColor: 'green',
  },
  {
    key: 'client-contract',
    title: 'Client Contract',
    description: 'Standard client contract with scope of work, payment terms, timeline, and terms & conditions with signature blocks.',
    category: 'client',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    badgeColor: 'green',
  },
];

const CATEGORIES = [
  { key: 'all', label: 'All Templates' },
  { key: 'employee', label: 'Employee / HR' },
  { key: 'client', label: 'Client' },
  { key: 'legal', label: 'Legal' },
];

const today = new Date().toISOString().split('T')[0];

export function AdminContracts() {
  const [filter, setFilter] = useState('all');
  const [active, setActive] = useState<TemplateKey | null>(null);
  const [generating, setGenerating] = useState(false);

  const filtered = filter === 'all' ? TEMPLATES : TEMPLATES.filter(t => t.category === filter);

  // ── Employee Agreement state ─────────────────────────────────────
  const [ea, setEa] = useState({
    employee_name: '', employee_email: '', role: 'VA (Cold Caller)',
    start_date: today, compensation: '', commission_structure: '',
    schedule: '', probation_period: '90 days', termination_notice: '14 days',
  });

  // ── NDA state ────────────────────────────────────────────────────
  const [nda, setNda] = useState({
    party_name: '', party_email: '', party_type: 'employee' as const,
    effective_date: today, duration: '2 years',
  });

  // ── Contractor state ─────────────────────────────────────────────
  const [ca, setCa] = useState({
    contractor_name: '', contractor_email: '', services_description: '',
    compensation: '', start_date: today, end_date: '', payment_terms: 'Net 15',
  });

  // ── Service Agreement state ──────────────────────────────────────
  const [sa, setSa] = useState({
    client_company: '', client_contact: '', client_email: '',
    start_date: today, timeline: '', revisions: '3', deposit_percentage: '50',
    payment_terms: '', services: [{ name: '', price: '' }] as { name: string; price: string }[],
  });

  // ── Business Proposal state ──────────────────────────────────────
  const [bp, setBp] = useState({
    company_name: '', contact_name: '', contact_email: '',
    description: '', timeline: '', valid_until: '',
    services: [{ name: '', price: '' }] as { name: string; price: string }[],
  });

  // ── Client Contract state ────────────────────────────────────────
  const [cc, setCc] = useState({
    company_name: '', contact_name: '', contact_email: '',
    timeline: '', deposit_amount: '', payment_terms: '', start_date: today,
    services: [{ name: '', price: '' }] as { name: string; price: string }[],
  });

  const addServiceRow = (target: 'sa' | 'bp' | 'cc') => {
    if (target === 'sa') setSa(p => ({ ...p, services: [...p.services, { name: '', price: '' }] }));
    if (target === 'bp') setBp(p => ({ ...p, services: [...p.services, { name: '', price: '' }] }));
    if (target === 'cc') setCc(p => ({ ...p, services: [...p.services, { name: '', price: '' }] }));
  };

  const updateService = (target: 'sa' | 'bp' | 'cc', idx: number, field: 'name' | 'price', val: string) => {
    const updater = (prev: { name: string; price: string }[]) => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s);
    if (target === 'sa') setSa(p => ({ ...p, services: updater(p.services) }));
    if (target === 'bp') setBp(p => ({ ...p, services: updater(p.services) }));
    if (target === 'cc') setCc(p => ({ ...p, services: updater(p.services) }));
  };

  const removeService = (target: 'sa' | 'bp' | 'cc', idx: number) => {
    if (target === 'sa') setSa(p => ({ ...p, services: p.services.filter((_, i) => i !== idx) }));
    if (target === 'bp') setBp(p => ({ ...p, services: p.services.filter((_, i) => i !== idx) }));
    if (target === 'cc') setCc(p => ({ ...p, services: p.services.filter((_, i) => i !== idx) }));
  };

  const downloadPDF = async (endpoint: string, payload: unknown) => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/contracts/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' }));
        alert(err.error || 'Failed to generate PDF');
        setGenerating(false);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="(.+?)"/);
      a.download = match ? match[1] : 'contract.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to generate PDF');
    }
    setGenerating(false);
  };

  function parsedServices(svcs: { name: string; price: string }[]) {
    return svcs.filter(s => s.name && s.price).map(s => ({ name: s.name, price: parseFloat(s.price) || 0 }));
  }

  function servicesTotal(svcs: { name: string; price: string }[]) {
    return parsedServices(svcs).reduce((sum, s) => sum + s.price, 0);
  }

  const handleGenerate = () => {
    switch (active) {
      case 'employee-agreement':
        downloadPDF('employee-agreement', ea);
        break;
      case 'nda':
        downloadPDF('nda', nda);
        break;
      case 'contractor-agreement':
        downloadPDF('contractor-agreement', ca);
        break;
      case 'service-agreement':
        downloadPDF('service-agreement', {
          ...sa,
          services: parsedServices(sa.services),
          total: servicesTotal(sa.services),
          revisions: parseInt(sa.revisions) || 3,
          deposit_percentage: parseInt(sa.deposit_percentage) || 50,
        });
        break;
      case 'client-proposal':
        downloadPDF('client-proposal', {
          ...bp,
          services: parsedServices(bp.services),
          total: servicesTotal(bp.services),
        });
        break;
      case 'client-contract':
        downloadPDF('client-contract', {
          ...cc,
          services: parsedServices(cc.services),
          total: servicesTotal(cc.services),
          deposit_amount: cc.deposit_amount ? parseFloat(cc.deposit_amount) : undefined,
        });
        break;
    }
  };

  const modalTitle = TEMPLATES.find(t => t.key === active)?.title || '';

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contracts & Templates</h1>
        <p className="mt-1 text-sm text-gray-500">
          Generate professional PDF documents — fill in the details and download instantly
        </p>
      </div>

      {/* Category filter */}
      <div className="flex gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              filter === c.key
                ? 'bg-neutral-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-[#0a0a0a] dark:text-gray-400 dark:hover:bg-[#111]'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Template gallery */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((tmpl) => (
          <div
            key={tmpl.key}
            className="group relative rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-neutral-300 cursor-pointer dark:border-[#1a1a1a] dark:bg-[#0a0a0a] dark:hover:border-neutral-700"
            onClick={() => setActive(tmpl.key)}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 group-hover:bg-neutral-50 group-hover:text-neutral-800 dark:bg-[#111] dark:text-gray-400 dark:group-hover:bg-[#1a1a1a] dark:group-hover:text-white transition-colors">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={tmpl.icon} />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{tmpl.title}</h3>
                  <Badge variant={tmpl.badgeColor}>
                    {tmpl.category === 'employee' ? 'HR' : tmpl.category === 'client' ? 'Client' : 'Legal'}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{tmpl.description}</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <span className="text-xs font-medium text-neutral-700 dark:text-white group-hover:underline">
                Fill & Download →
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Modals ───────────────────────────────────────────────────── */}

      {/* Employee Agreement */}
      <Modal open={active === 'employee-agreement'} onClose={() => setActive(null)} title={modalTitle} size="lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Employee Full Name *" value={ea.employee_name} onChange={(e) => setEa(p => ({ ...p, employee_name: e.target.value }))} placeholder="John Smith" />
            <Input label="Email" type="email" value={ea.employee_email} onChange={(e) => setEa(p => ({ ...p, employee_email: e.target.value }))} placeholder="john@gmail.com" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Role *" value={ea.role} onChange={(e) => setEa(p => ({ ...p, role: e.target.value }))} options={[
              { value: 'VA (Cold Caller)', label: 'VA (Cold Caller)' },
              { value: 'Closer', label: 'Closer' },
              { value: 'Operations', label: 'Operations' },
            ]} />
            <Input label="Start Date *" type="date" value={ea.start_date} onChange={(e) => setEa(p => ({ ...p, start_date: e.target.value }))} />
          </div>
          <Input label="Compensation" value={ea.compensation} onChange={(e) => setEa(p => ({ ...p, compensation: e.target.value }))} placeholder="e.g. $45,000/year base salary" />
          <Input label="Commission Structure" value={ea.commission_structure} onChange={(e) => setEa(p => ({ ...p, commission_structure: e.target.value }))} placeholder="e.g. 10% commission on closed deals" />
          <Input label="Work Schedule" value={ea.schedule} onChange={(e) => setEa(p => ({ ...p, schedule: e.target.value }))} placeholder="e.g. Monday-Friday 9am-5pm EST" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Probation Period" value={ea.probation_period} onChange={(e) => setEa(p => ({ ...p, probation_period: e.target.value }))} />
            <Input label="Termination Notice" value={ea.termination_notice} onChange={(e) => setEa(p => ({ ...p, termination_notice: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t dark:border-[#1a1a1a]">
            <Button variant="secondary" onClick={() => setActive(null)}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={generating || !ea.employee_name || !ea.start_date}>
              {generating ? 'Generating...' : 'Download PDF'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* NDA */}
      <Modal open={active === 'nda'} onClose={() => setActive(null)} title={modalTitle} size="md">
        <div className="space-y-4">
          <Input label="Party Name *" value={nda.party_name} onChange={(e) => setNda(p => ({ ...p, party_name: e.target.value }))} placeholder="Full name or company" />
          <Input label="Email" type="email" value={nda.party_email} onChange={(e) => setNda(p => ({ ...p, party_email: e.target.value }))} placeholder="email@example.com" />
          <Select label="Party Type" value={nda.party_type} onChange={(e) => setNda(p => ({ ...p, party_type: e.target.value as any }))} options={[
            { value: 'employee', label: 'Employee' },
            { value: 'contractor', label: 'Contractor' },
            { value: 'client', label: 'Client' },
            { value: 'partner', label: 'Partner' },
          ]} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Effective Date *" type="date" value={nda.effective_date} onChange={(e) => setNda(p => ({ ...p, effective_date: e.target.value }))} />
            <Input label="Duration" value={nda.duration} onChange={(e) => setNda(p => ({ ...p, duration: e.target.value }))} placeholder="2 years" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t dark:border-[#1a1a1a]">
            <Button variant="secondary" onClick={() => setActive(null)}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={generating || !nda.party_name || !nda.effective_date}>
              {generating ? 'Generating...' : 'Download PDF'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Contractor Agreement */}
      <Modal open={active === 'contractor-agreement'} onClose={() => setActive(null)} title={modalTitle} size="lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Contractor Name *" value={ca.contractor_name} onChange={(e) => setCa(p => ({ ...p, contractor_name: e.target.value }))} placeholder="Jane Doe" />
            <Input label="Email" type="email" value={ca.contractor_email} onChange={(e) => setCa(p => ({ ...p, contractor_email: e.target.value }))} placeholder="jane@freelancer.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scope of Services *</label>
            <textarea
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 dark:bg-[#0a0a0a] dark:border-[#262626] dark:text-gray-100"
              rows={3}
              value={ca.services_description}
              onChange={(e) => setCa(p => ({ ...p, services_description: e.target.value }))}
              placeholder="Describe the services to be performed..."
            />
          </div>
          <Input label="Compensation *" value={ca.compensation} onChange={(e) => setCa(p => ({ ...p, compensation: e.target.value }))} placeholder="e.g. $5,000/month or $75/hour" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Date *" type="date" value={ca.start_date} onChange={(e) => setCa(p => ({ ...p, start_date: e.target.value }))} />
            <Input label="End Date" type="date" value={ca.end_date} onChange={(e) => setCa(p => ({ ...p, end_date: e.target.value }))} />
          </div>
          <Input label="Payment Terms" value={ca.payment_terms} onChange={(e) => setCa(p => ({ ...p, payment_terms: e.target.value }))} placeholder="Net 15" />
          <div className="flex justify-end gap-2 pt-2 border-t dark:border-[#1a1a1a]">
            <Button variant="secondary" onClick={() => setActive(null)}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={generating || !ca.contractor_name || !ca.services_description || !ca.compensation || !ca.start_date}>
              {generating ? 'Generating...' : 'Download PDF'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Service Agreement */}
      <Modal open={active === 'service-agreement'} onClose={() => setActive(null)} title={modalTitle} size="lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Client Company *" value={sa.client_company} onChange={(e) => setSa(p => ({ ...p, client_company: e.target.value }))} placeholder="Acme Corp" />
            <Input label="Contact Name *" value={sa.client_contact} onChange={(e) => setSa(p => ({ ...p, client_contact: e.target.value }))} placeholder="John Smith" />
          </div>
          <Input label="Email" type="email" value={sa.client_email} onChange={(e) => setSa(p => ({ ...p, client_email: e.target.value }))} placeholder="john@acme.com" />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Services *</label>
            {sa.services.map((svc, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <Input className="flex-1" value={svc.name} onChange={(e) => updateService('sa', i, 'name', e.target.value)} placeholder="Service name" />
                <Input className="w-32" type="number" value={svc.price} onChange={(e) => updateService('sa', i, 'price', e.target.value)} placeholder="Price" />
                {sa.services.length > 1 && (
                  <button onClick={() => removeService('sa', i)} className="text-red-500 hover:text-red-700 text-sm px-2">✕</button>
                )}
              </div>
            ))}
            <button onClick={() => addServiceRow('sa')} className="text-sm text-neutral-700 hover:text-neutral-800 dark:text-white font-medium">+ Add service</button>
            {servicesTotal(sa.services) > 0 && (
              <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                Total: ${servicesTotal(sa.services).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input label="Start Date *" type="date" value={sa.start_date} onChange={(e) => setSa(p => ({ ...p, start_date: e.target.value }))} />
            <Input label="Timeline" value={sa.timeline} onChange={(e) => setSa(p => ({ ...p, timeline: e.target.value }))} placeholder="6-8 weeks" />
            <Input label="Revisions" type="number" value={sa.revisions} onChange={(e) => setSa(p => ({ ...p, revisions: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Deposit %" type="number" value={sa.deposit_percentage} onChange={(e) => setSa(p => ({ ...p, deposit_percentage: e.target.value }))} />
            <Input label="Payment Terms" value={sa.payment_terms} onChange={(e) => setSa(p => ({ ...p, payment_terms: e.target.value }))} placeholder="Balance due on completion" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t dark:border-[#1a1a1a]">
            <Button variant="secondary" onClick={() => setActive(null)}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={generating || !sa.client_company || !sa.client_contact || parsedServices(sa.services).length === 0}>
              {generating ? 'Generating...' : 'Download PDF'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Business Proposal */}
      <Modal open={active === 'client-proposal'} onClose={() => setActive(null)} title={modalTitle} size="lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Company Name *" value={bp.company_name} onChange={(e) => setBp(p => ({ ...p, company_name: e.target.value }))} placeholder="Acme Corp" />
            <Input label="Contact Name *" value={bp.contact_name} onChange={(e) => setBp(p => ({ ...p, contact_name: e.target.value }))} placeholder="John Smith" />
          </div>
          <Input label="Email" type="email" value={bp.contact_email} onChange={(e) => setBp(p => ({ ...p, contact_email: e.target.value }))} placeholder="john@acme.com" />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project Description</label>
            <textarea
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 dark:bg-[#0a0a0a] dark:border-[#262626] dark:text-gray-100"
              rows={3}
              value={bp.description}
              onChange={(e) => setBp(p => ({ ...p, description: e.target.value }))}
              placeholder="Brief overview of the project..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Proposed Services *</label>
            {bp.services.map((svc, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <Input className="flex-1" value={svc.name} onChange={(e) => updateService('bp', i, 'name', e.target.value)} placeholder="Service name" />
                <Input className="w-32" type="number" value={svc.price} onChange={(e) => updateService('bp', i, 'price', e.target.value)} placeholder="Price" />
                {bp.services.length > 1 && (
                  <button onClick={() => removeService('bp', i)} className="text-red-500 hover:text-red-700 text-sm px-2">✕</button>
                )}
              </div>
            ))}
            <button onClick={() => addServiceRow('bp')} className="text-sm text-neutral-700 hover:text-neutral-800 dark:text-white font-medium">+ Add service</button>
            {servicesTotal(bp.services) > 0 && (
              <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                Total: ${servicesTotal(bp.services).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Timeline" value={bp.timeline} onChange={(e) => setBp(p => ({ ...p, timeline: e.target.value }))} placeholder="4-6 weeks" />
            <Input label="Valid Until" type="date" value={bp.valid_until} onChange={(e) => setBp(p => ({ ...p, valid_until: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t dark:border-[#1a1a1a]">
            <Button variant="secondary" onClick={() => setActive(null)}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={generating || !bp.company_name || !bp.contact_name || parsedServices(bp.services).length === 0}>
              {generating ? 'Generating...' : 'Download PDF'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Client Contract */}
      <Modal open={active === 'client-contract'} onClose={() => setActive(null)} title={modalTitle} size="lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Company Name *" value={cc.company_name} onChange={(e) => setCc(p => ({ ...p, company_name: e.target.value }))} placeholder="Acme Corp" />
            <Input label="Contact Name *" value={cc.contact_name} onChange={(e) => setCc(p => ({ ...p, contact_name: e.target.value }))} placeholder="John Smith" />
          </div>
          <Input label="Email" type="email" value={cc.contact_email} onChange={(e) => setCc(p => ({ ...p, contact_email: e.target.value }))} placeholder="john@acme.com" />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Services *</label>
            {cc.services.map((svc, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <Input className="flex-1" value={svc.name} onChange={(e) => updateService('cc', i, 'name', e.target.value)} placeholder="Service name" />
                <Input className="w-32" type="number" value={svc.price} onChange={(e) => updateService('cc', i, 'price', e.target.value)} placeholder="Price" />
                {cc.services.length > 1 && (
                  <button onClick={() => removeService('cc', i)} className="text-red-500 hover:text-red-700 text-sm px-2">✕</button>
                )}
              </div>
            ))}
            <button onClick={() => addServiceRow('cc')} className="text-sm text-neutral-700 hover:text-neutral-800 dark:text-white font-medium">+ Add service</button>
            {servicesTotal(cc.services) > 0 && (
              <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                Total: ${servicesTotal(cc.services).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Date *" type="date" value={cc.start_date} onChange={(e) => setCc(p => ({ ...p, start_date: e.target.value }))} />
            <Input label="Timeline" value={cc.timeline} onChange={(e) => setCc(p => ({ ...p, timeline: e.target.value }))} placeholder="6-8 weeks" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Deposit Amount ($)" type="number" value={cc.deposit_amount} onChange={(e) => setCc(p => ({ ...p, deposit_amount: e.target.value }))} placeholder="2500" />
            <Input label="Payment Terms" value={cc.payment_terms} onChange={(e) => setCc(p => ({ ...p, payment_terms: e.target.value }))} placeholder="50% deposit, balance on completion" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t dark:border-[#1a1a1a]">
            <Button variant="secondary" onClick={() => setActive(null)}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={generating || !cc.company_name || !cc.contact_name || parsedServices(cc.services).length === 0}>
              {generating ? 'Generating...' : 'Download PDF'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
