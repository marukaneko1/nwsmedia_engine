import { useState, useEffect, FormEvent } from 'react';
import { useParams } from 'react-router-dom';

const REVENUE_RANGES = [
  'Under $50K',
  '$50K – $100K',
  '$100K – $250K',
  '$250K – $500K',
  '$500K – $1M',
  '$1M – $5M',
  '$5M – $10M',
  '$10M+',
  'Prefer not to say',
];

const TEAM_SIZES = [
  'Just me',
  '2 – 5',
  '6 – 10',
  '11 – 25',
  '26 – 50',
  '51 – 100',
  '100+',
];

export function ClientIntakeForm() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    client_name: '',
    business_name: '',
    email: '',
    phone: '',
    website: '',
    revenue_range: '',
    team_size: '',
    looking_for: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/client-intake/${token}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Invalid link');
        }
        setLoading(false);
      } catch {
        setError('Failed to validate link');
        setLoading(false);
      }
    })();
  }, [token]);

  const set = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.client_name.trim() || !form.business_name.trim()) {
      setError('Please fill in your name and business name.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/client-intake/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Submission failed');
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setError('Submission failed. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-white dark:from-gray-950 dark:to-gray-900">
        <div className="flex items-center gap-3 rounded-2xl border bg-white px-8 py-6 shadow-sm dark:border-[#1a1a1a] dark:bg-[#0a0a0a]">
          <div className="h-8 w-8 shrink-0 rounded-full border-2 border-sky-200 border-t-sky-600 animate-spin" />
          <p className="text-sm text-slate-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !form.client_name && !submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-white dark:from-gray-950 dark:to-gray-900 px-4">
        <div className="rounded-2xl border bg-white p-8 shadow-sm dark:border-[#1a1a1a] dark:bg-[#0a0a0a] text-center max-w-md">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <svg className="h-7 w-7 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{error}</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Please contact us for a valid link.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-white dark:from-gray-950 dark:to-gray-900 px-4">
        <div className="rounded-2xl border bg-white p-8 shadow-sm dark:border-[#1a1a1a] dark:bg-[#0a0a0a] text-center max-w-md">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <svg className="h-7 w-7 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Thank You!</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            We've received your information. Our team will be in touch soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-sky-50/50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 py-10 px-4">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <img src="/logo.jpeg" alt="NWS Media" className="mx-auto h-14 w-14 rounded-2xl object-cover mb-4 shadow-md shadow-sky-200/40" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Let's Get Started
          </h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Tell us about yourself and your business.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="rounded-2xl border bg-white shadow-sm dark:border-[#1a1a1a] dark:bg-[#0a0a0a] p-6 space-y-5">
            {/* Client Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Your Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:bg-black dark:border-[#262626] dark:text-gray-100"
                value={form.client_name}
                onChange={(e) => set('client_name', e.target.value)}
                placeholder="Jane Smith"
              />
            </div>

            {/* Business Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Business Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:bg-black dark:border-[#262626] dark:text-gray-100"
                value={form.business_name}
                onChange={(e) => set('business_name', e.target.value)}
                placeholder="Acme Corp"
              />
            </div>

            {/* Email & Phone */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:bg-black dark:border-[#262626] dark:text-gray-100"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                <input
                  type="tel"
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:bg-black dark:border-[#262626] dark:text-gray-100"
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            {/* Website */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Website</label>
              <input
                type="url"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:bg-black dark:border-[#262626] dark:text-gray-100"
                value={form.website}
                onChange={(e) => set('website', e.target.value)}
                placeholder="https://www.example.com"
              />
            </div>

            {/* Revenue Range & Team Size */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Annual Revenue</label>
                <select
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:bg-black dark:border-[#262626] dark:text-gray-100"
                  value={form.revenue_range}
                  onChange={(e) => set('revenue_range', e.target.value)}
                >
                  <option value="">Select a range...</option>
                  {REVENUE_RANGES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Team Size</label>
                <select
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:bg-black dark:border-[#262626] dark:text-gray-100"
                  value={form.team_size}
                  onChange={(e) => set('team_size', e.target.value)}
                >
                  <option value="">Select team size...</option>
                  {TEAM_SIZES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Looking For */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                What are you looking for? <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:bg-black dark:border-[#262626] dark:text-gray-100"
                rows={3}
                value={form.looking_for}
                onChange={(e) => set('looking_for', e.target.value)}
                placeholder="Website design, social media management, branding, marketing..."
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:from-sky-700 hover:to-indigo-700 focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:opacity-50 transition-all"
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
          Powered by NWS Media
        </p>
      </div>
    </div>
  );
}
