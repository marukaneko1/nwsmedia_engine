import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

async function portalApi(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('portal_token');
  const res = await fetch(`/api/portal${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers as any },
  });
  return res.json();
}

export function PortalReferral() {
  const navigate = useNavigate();
  const [company_name, setCompanyName] = useState('');
  const [contact_name, setContactName] = useState('');
  const [contact_email, setContactEmail] = useState('');
  const [contact_phone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('portal_token')) {
      navigate('/portal/login', { replace: true });
    }
  }, [navigate]);

  const logout = () => {
    localStorage.removeItem('portal_token');
    navigate('/portal/login', { replace: true });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setSuccess(false);
    try {
      const data = await portalApi('/referrals/submit', {
        method: 'POST',
        body: JSON.stringify({
          company_name,
          contact_name: contact_name || undefined,
          contact_email: contact_email || undefined,
          contact_phone: contact_phone || undefined,
          notes: notes || undefined,
        }),
      });
      if (data.error) {
        setError(data.error);
        return;
      }
      setSuccess(true);
      setCompanyName('');
      setContactName('');
      setContactEmail('');
      setContactPhone('');
      setNotes('');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/90 via-white to-sky-50/50">
      <header className="sticky top-0 z-10 border-b border-sky-100/90 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <button type="button" className="flex items-center gap-3 text-left" onClick={() => navigate('/portal/dashboard')}>
            <img src="/logo.jpeg" alt="NWS Media" className="h-10 w-10 rounded-xl object-cover shadow-md shadow-sky-200/40" />
            <div>
              <p className="text-sm font-semibold text-slate-800">NWS Media</p>
              <p className="text-xs text-sky-600/90">Client Portal</p>
            </div>
          </button>
          <Button variant="ghost" className="text-slate-600 hover:bg-sky-50" onClick={logout}>
            Logout
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8">
          <button type="button" className="text-sm font-medium text-sky-600 hover:text-sky-700" onClick={() => navigate('/portal/dashboard')}>
            ← Back to dashboard
          </button>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">Submit a referral</h1>
          <p className="mt-2 text-slate-600">
            Know a business that could use a new site or marketing help? Introduce us — you&apos;ll earn a{' '}
            <span className="font-semibold text-sky-700">$500 account credit</span> when they become a client.
          </p>
        </div>

        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          <span className="font-semibold">$500 credit</span> applies per successful referral per our program terms. Our team will follow up with your contact promptly.
        </div>

        <Card className="border-sky-100 bg-white/90 shadow-sky-100/30">
          {success ? (
            <div className="rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-5 text-center text-sm text-slate-700">
              <p className="font-medium text-sky-900">Referral received</p>
              <p className="mt-2">Thank you — we&apos;ll reach out and keep you posted.</p>
              <Button type="button" variant="secondary" className="mt-6" onClick={() => setSuccess(false)}>
                Submit another
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
              )}
              <Input
                label="Company name"
                value={company_name}
                onChange={(ev) => setCompanyName(ev.target.value)}
                required
                placeholder="Acme Co."
                className="border-sky-100 focus:border-sky-400 focus:ring-sky-400"
              />
              <Input
                label="Contact name"
                value={contact_name}
                onChange={(ev) => setContactName(ev.target.value)}
                placeholder="Jane Smith"
                className="border-sky-100 focus:border-sky-400 focus:ring-sky-400"
              />
              <Input
                label="Contact email"
                type="email"
                value={contact_email}
                onChange={(ev) => setContactEmail(ev.target.value)}
                placeholder="jane@acme.com"
                className="border-sky-100 focus:border-sky-400 focus:ring-sky-400"
              />
              <Input
                label="Contact phone"
                type="tel"
                value={contact_phone}
                onChange={(ev) => setContactPhone(ev.target.value)}
                placeholder="(555) 123-4567"
                className="border-sky-100 focus:border-sky-400 focus:ring-sky-400"
              />
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={notes}
                  onChange={(ev) => setNotes(ev.target.value)}
                  rows={4}
                  placeholder="Anything we should know about their goals or timeline?"
                  className="block w-full rounded-lg border border-sky-100 px-3 py-2 text-sm shadow-sm transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button type="submit" disabled={loading} className="bg-sky-600 hover:bg-sky-700 focus:ring-sky-500">
                  {loading ? 'Submitting…' : 'Submit referral'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => navigate('/portal/dashboard')}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </Card>
      </main>
    </div>
  );
}
