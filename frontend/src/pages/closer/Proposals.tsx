import { useState, useEffect } from 'react';
import { api } from '../../utils/api';

interface Service { name: string; price: number }
interface Template {
  id: string;
  name: string;
  services: Service[];
  total: number;
  timeline: string;
  description: string | null;
}
interface Deal {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  value: number;
  stage: string;
}

export function CloserProposals() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [customServices, setCustomServices] = useState<Service[]>([]);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [tmplRes, dealRes] = await Promise.all([
        api.get<{ data: Template[] }>('/proposals/templates'),
        api.get<{ data: Deal[] }>('/deals'),
      ]);
      setTemplates(tmplRes.data.map((t: any) => ({
        ...t,
        services: typeof t.services === 'string' ? JSON.parse(t.services) : t.services,
      })));
      setDeals(dealRes.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  function selectTemplate(t: Template) {
    setSelectedTemplate(t);
    setCustomServices([...t.services]);
  }

  function selectDeal(d: Deal) {
    setSelectedDeal(d);
    setClientName(d.contact_name || d.company_name);
    setClientEmail(d.contact_email || '');
  }

  function updateService(idx: number, field: 'name' | 'price', value: string | number) {
    setCustomServices((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: field === 'price' ? Number(value) : value } : s));
  }

  function removeService(idx: number) {
    setCustomServices((prev) => prev.filter((_, i) => i !== idx));
  }

  function addService() {
    setCustomServices((prev) => [...prev, { name: '', price: 0 }]);
  }

  const total = customServices.reduce((sum, s) => sum + s.price, 0);

  function resetForm() {
    setSelectedTemplate(null);
    setSelectedDeal(null);
    setCustomServices([]);
    setClientName('');
    setClientEmail('');
    setNotes('');
    setShowPreview(false);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-600 border-t-transparent dark:border-white dark:border-t-transparent" />
      </div>
    );
  }

  if (showPreview) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <button onClick={() => setShowPreview(false)} className="mb-4 text-sm text-neutral-700 hover:text-neutral-800 dark:text-white flex items-center gap-1">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Back to editor
        </button>
        <div className="rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <img src="/logo.jpeg" alt="NWS Media" className="h-8 w-8 rounded-lg object-cover" />
                <span className="text-xl font-bold text-gray-900 dark:text-gray-100">NWS Media</span>
              </div>
              <p className="text-xs text-gray-400">Business Proposal</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 dark:text-gray-400">Prepared for</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{clientName || 'Client Name'}</p>
              {clientEmail && <p className="text-sm text-gray-500 dark:text-gray-400">{clientEmail}</p>}
            </div>
          </div>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">{selectedTemplate?.name || 'Custom Proposal'}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Timeline: {selectedTemplate?.timeline || 'TBD'}</p>

          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="border-b border-gray-200 dark:border-[#1a1a1a]">
                <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Service</th>
                <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400">Price</th>
              </tr>
            </thead>
            <tbody>
              {customServices.map((s, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-[#1a1a1a]/50">
                  <td className="py-3 text-gray-900 dark:text-gray-100">{s.name}</td>
                  <td className="py-3 text-right text-gray-900 dark:text-gray-100">${s.price.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-3 font-semibold text-gray-900 dark:text-gray-100">Total</td>
                <td className="pt-3 text-right font-bold text-lg text-neutral-700 dark:text-white">${total.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>

          {notes && (
            <div className="rounded-lg bg-gray-50 dark:bg-[#111] p-4 mb-6">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase">Notes</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{notes}</p>
            </div>
          )}

          <div className="border-t border-gray-200 dark:border-[#1a1a1a] pt-4 text-center text-xs text-gray-400">
            Generated on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        <div className="flex gap-3 mt-4 justify-end">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-[#262626] px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#111]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 12h.008v.008h-.008V12zm-8.25 0h.008v.008H10.5V12z" /></svg>
            Print
          </button>
          <button
            onClick={resetForm}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
          >
            New Proposal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Proposal Builder</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Create client proposals from templates or build custom</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: template + deal selection */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Choose Template</h3>
            <div className="space-y-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectTemplate(t)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    selectedTemplate?.id === t.id
                      ? 'border-neutral-500 bg-neutral-50 dark:bg-[#111] dark:border-neutral-700'
                      : 'border-gray-200 dark:border-[#1a1a1a] hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{t.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">${t.total.toLocaleString()} &middot; {t.timeline}</p>
                </button>
              ))}
              <button
                onClick={() => { setSelectedTemplate(null); setCustomServices([{ name: '', price: 0 }]); }}
                className={`w-full text-left rounded-lg border border-dashed p-3 transition-colors ${
                  !selectedTemplate && customServices.length > 0
                    ? 'border-neutral-500 bg-neutral-50 dark:bg-[#111]'
                    : 'border-gray-300 dark:border-[#262626] hover:border-gray-400'
                }`}
              >
                <p className="font-medium text-sm text-gray-600 dark:text-gray-300">+ Custom Proposal</p>
                <p className="text-xs text-gray-400">Build from scratch</p>
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Link to Deal (optional)</h3>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {deals.filter((d) => d.stage !== 'lost').map((d) => (
                <button
                  key={d.id}
                  onClick={() => selectDeal(d)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
                    selectedDeal?.id === d.id
                      ? 'bg-neutral-50 text-neutral-800 dark:bg-[#111] dark:text-white'
                      : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-[#111]'
                  }`}
                >
                  {d.company_name} &middot; ${d.value?.toLocaleString() || 0}
                </button>
              ))}
              {deals.length === 0 && <p className="text-xs text-gray-400 px-3">No active deals</p>}
            </div>
          </div>
        </div>

        {/* Right: service editor + client info */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] p-5">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Client Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Client Name</label>
                <input
                  className="w-full rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Company or contact name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Client Email</label>
                <input
                  className="w-full rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="client@company.com"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Services</h3>
              <button onClick={addService} className="text-xs text-neutral-700 hover:text-neutral-800 dark:text-white">+ Add Service</button>
            </div>
            <div className="space-y-2">
              {customServices.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="flex-1 rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                    value={s.name}
                    onChange={(e) => updateService(i, 'name', e.target.value)}
                    placeholder="Service name"
                  />
                  <div className="relative w-32">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                    <input
                      type="number"
                      className="w-full rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] pl-7 pr-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                      value={s.price || ''}
                      onChange={(e) => updateService(i, 'price', e.target.value)}
                    />
                  </div>
                  <button onClick={() => removeService(i)} className="text-gray-400 hover:text-red-500 p-1">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-between items-center pt-3 border-t border-gray-200 dark:border-[#1a1a1a]">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total</span>
              <span className="text-lg font-bold text-neutral-700 dark:text-white">${total.toLocaleString()}</span>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] p-5">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Additional Notes</h3>
            <textarea
              className="w-full rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment terms, special conditions, etc."
            />
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={resetForm} className="rounded-lg border border-gray-300 dark:border-[#262626] px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#111]">
              Reset
            </button>
            <button
              onClick={() => setShowPreview(true)}
              disabled={customServices.length === 0}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
            >
              Preview Proposal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
