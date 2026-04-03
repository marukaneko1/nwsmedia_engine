import { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';

type Step = 'business' | 'branding' | 'socials' | 'goals' | 'review';
const STEPS: { key: Step; label: string }[] = [
  { key: 'business', label: 'Business Info' },
  { key: 'branding', label: 'Branding' },
  { key: 'socials', label: 'Online Presence' },
  { key: 'goals', label: 'Project Goals' },
  { key: 'review', label: 'Review' },
];

export function OnboardingForm() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('business');
  const [alreadyDone, setAlreadyDone] = useState(false);

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

  const [form, setForm] = useState({
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    company_name: '',
    existing_website: '',
    revenue_range: '',
    team_size: '',
    looking_for: '',
    business_description: '',
    business_hours: '',
    target_audience: '',
    brand_guidelines: '',
    competitors: '',
    special_requirements: '',
    project_goals: [''],
    content_tone: '',
    inspirations: '',
    additional_notes: '',
    social_facebook: '',
    social_instagram: '',
    social_linkedin: '',
    social_tiktok: '',
    social_youtube: '',
    social_twitter: '',
    color_preferences: '',
  });

  const [projectName, setProjectName] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/onboarding/${token}`);
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'Invalid link'); setLoading(false); return; }
        if (data.onboarding_completed_at) { setAlreadyDone(true); }

        setProjectName(data.project_name || '');
        setForm((f) => ({
          ...f,
          contact_name: data.contact_name || '',
          contact_email: data.contact_email || '',
          contact_phone: data.contact_phone || '',
          company_name: data.company_name || '',
          existing_website: data.existing_website || '',
          revenue_range: data.revenue_range || '',
          team_size: data.team_size || '',
          looking_for: data.looking_for || '',
          business_description: data.business_description || '',
          business_hours: data.business_hours || '',
          target_audience: data.target_audience || '',
          brand_guidelines: data.brand_guidelines || '',
          competitors: data.competitors || '',
          special_requirements: data.special_requirements || '',
          project_goals: data.project_goals?.length ? data.project_goals : [''],
          content_tone: data.content_tone || '',
          inspirations: data.inspirations || '',
          additional_notes: data.additional_notes || '',
          social_facebook: data.social_facebook || '',
          social_instagram: data.social_instagram || '',
          social_linkedin: data.social_linkedin || '',
          social_tiktok: data.social_tiktok || '',
          social_youtube: data.social_youtube || '',
          social_twitter: data.social_twitter || '',
          color_preferences: data.color_preferences || '',
        }));
        setLoading(false);
      } catch { setError('Failed to load onboarding form'); setLoading(false); }
    })();
  }, [token]);

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));
  const setGoal = (i: number, val: string) => setForm((f) => {
    const goals = [...f.project_goals];
    goals[i] = val;
    return { ...f, project_goals: goals };
  });
  const addGoal = () => setForm((f) => ({ ...f, project_goals: [...f.project_goals, ''] }));
  const removeGoal = (i: number) => setForm((f) => ({ ...f, project_goals: f.project_goals.filter((_, idx) => idx !== i) }));

  const stepIdx = STEPS.findIndex((s) => s.key === step);
  const next = () => { if (stepIdx < STEPS.length - 1) setStep(STEPS[stepIdx + 1].key); };
  const prev = () => { if (stepIdx > 0) setStep(STEPS[stepIdx - 1].key); };

  const handleSubmit = async (e?: FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const body = { ...form, project_goals: form.project_goals.filter((g) => g.trim()) };
      const res = await fetch(`/api/onboarding/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Submission failed'); setSubmitting(false); return; }
      navigate(`/onboarding/${token}/tracker`);
    } catch { setError('Submission failed'); setSubmitting(false); }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-white dark:from-gray-950 dark:to-gray-900">
        <div className="flex items-center gap-3 rounded-2xl border bg-white px-8 py-6 shadow-sm dark:border-[#1a1a1a] dark:bg-[#0a0a0a]">
          <div className="h-8 w-8 shrink-0 rounded-full border-2 border-sky-200 border-t-sky-600 animate-spin" />
          <p className="text-sm text-slate-600 dark:text-gray-400">Loading your onboarding form...</p>
        </div>
      </div>
    );
  }

  if (error && !form.contact_name) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-white dark:from-gray-950 dark:to-gray-900 px-4">
        <div className="rounded-2xl border bg-white p-8 shadow-sm dark:border-[#1a1a1a] dark:bg-[#0a0a0a] text-center max-w-md">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <svg className="h-7 w-7 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{error}</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Please contact your project manager for a new link.</p>
        </div>
      </div>
    );
  }

  if (alreadyDone) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-white dark:from-gray-950 dark:to-gray-900 px-4">
        <div className="rounded-2xl border bg-white p-8 shadow-sm dark:border-[#1a1a1a] dark:bg-[#0a0a0a] text-center max-w-md">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <svg className="h-7 w-7 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Onboarding Already Complete</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            You've already submitted your information. You can update it below or track your project.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Button onClick={() => setAlreadyDone(false)} variant="secondary">Update My Information</Button>
            <Button onClick={() => navigate(`/onboarding/${token}/tracker`)}>Track My Project</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-sky-50/50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 py-10 px-4">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <img src="/logo.jpeg" alt="NWS Media" className="mx-auto h-14 w-14 rounded-2xl object-cover mb-4 shadow-md shadow-sky-200/40" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Welcome, {form.contact_name || 'there'}!</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Complete your onboarding{form.company_name && <> for <span className="font-medium text-gray-700 dark:text-gray-300">{form.company_name}</span></>}
            {projectName && <> &mdash; {projectName}</>}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-1 mb-8">
          {STEPS.map((s, i) => {
            const isActive = s.key === step;
            const isPast = stepIdx > i;
            return (
              <div key={s.key} className="flex items-center gap-1">
                {i > 0 && <div className={`h-0.5 w-6 sm:w-10 ${isPast ? 'bg-sky-500' : 'bg-gray-200 dark:bg-[#111]'}`} />}
                <button
                  type="button"
                  onClick={() => setStep(s.key)}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                    isActive ? 'bg-sky-600 text-white ring-4 ring-sky-100 dark:ring-sky-900/40'
                    : isPast ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400'
                    : 'bg-gray-100 text-gray-400 dark:bg-[#0a0a0a] dark:text-gray-500'
                  }`}
                >
                  {isPast ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  ) : i + 1}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mb-6 px-2">
          {STEPS.map((s, i) => (
            <span key={s.key} className={`text-xs text-center flex-1 ${stepIdx === i ? 'text-sky-700 dark:text-sky-400 font-medium' : 'text-gray-400'}`}>{s.label}</span>
          ))}
        </div>

        {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">{error}</div>}

        <form onSubmit={handleSubmit}>
          {step === 'business' && (
            <Card title="Business Information">
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Your Name *" value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} placeholder="Jane Smith" required />
                  <Input label="Business Name *" value={form.company_name} onChange={(e) => set('company_name', e.target.value)} placeholder="Acme Corp" required />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Email" type="email" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} placeholder="you@company.com" />
                  <Input label="Phone" type="tel" value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} placeholder="(555) 123-4567" />
                </div>
                <Input label="Website" value={form.existing_website} onChange={(e) => set('existing_website', e.target.value)} placeholder="https://www.example.com" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Annual Revenue Range</label>
                    <select
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 dark:bg-[#0a0a0a] dark:border-[#262626] dark:text-gray-100"
                      value={form.revenue_range}
                      onChange={(e) => set('revenue_range', e.target.value)}
                    >
                      <option value="">Select a range...</option>
                      {REVENUE_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Team Size</label>
                    <select
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 dark:bg-[#0a0a0a] dark:border-[#262626] dark:text-gray-100"
                      value={form.team_size}
                      onChange={(e) => set('team_size', e.target.value)}
                    >
                      <option value="">Select team size...</option>
                      {TEAM_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Describe Your Business</label>
                  <textarea className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 dark:bg-[#0a0a0a] dark:border-[#262626] dark:text-gray-100" rows={3} value={form.business_description} onChange={(e) => set('business_description', e.target.value)} placeholder="What does your business do? Who are your customers?" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    What are you looking for? <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 dark:bg-[#0a0a0a] dark:border-[#262626] dark:text-gray-100" rows={3} value={form.looking_for} onChange={(e) => set('looking_for', e.target.value)} placeholder="Tell us what services or help you're interested in — website design, social media, branding, etc." />
                </div>
                <Input label="Business Hours" value={form.business_hours} onChange={(e) => set('business_hours', e.target.value)} placeholder="Mon-Fri 9am-5pm" />
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Audience</label>
                  <textarea className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 dark:bg-[#0a0a0a] dark:border-[#262626] dark:text-gray-100" rows={2} value={form.target_audience} onChange={(e) => set('target_audience', e.target.value)} placeholder="Who are your ideal customers? Age, location, interests..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Competitors</label>
                  <textarea className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 dark:bg-[#0a0a0a] dark:border-[#262626] dark:text-gray-100" rows={2} value={form.competitors} onChange={(e) => set('competitors', e.target.value)} placeholder="List your main competitors or businesses you admire..." />
                </div>
              </div>
            </Card>
          )}

          {step === 'branding' && (
            <Card title="Branding & Style">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Brand Guidelines</label>
                  <textarea className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 dark:bg-[#0a0a0a] dark:border-[#262626] dark:text-gray-100" rows={3} value={form.brand_guidelines} onChange={(e) => set('brand_guidelines', e.target.value)} placeholder="Do you have existing brand guidelines, fonts, or a style guide?" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Color Preferences</label>
                  <textarea className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 dark:bg-[#0a0a0a] dark:border-[#262626] dark:text-gray-100" rows={2} value={form.color_preferences} onChange={(e) => set('color_preferences', e.target.value)} placeholder="What colors represent your brand? Any colors to avoid?" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content Tone & Voice</label>
                  <textarea className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 dark:bg-[#0a0a0a] dark:border-[#262626] dark:text-gray-100" rows={2} value={form.content_tone} onChange={(e) => set('content_tone', e.target.value)} placeholder="Professional, casual, friendly, authoritative, playful..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Inspirations</label>
                  <textarea className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 dark:bg-[#0a0a0a] dark:border-[#262626] dark:text-gray-100" rows={2} value={form.inspirations} onChange={(e) => set('inspirations', e.target.value)} placeholder="Share links to websites or brands you love the look of..." />
                </div>
              </div>
            </Card>
          )}

          {step === 'socials' && (
            <Card title="Online Presence">
              <div className="space-y-5">
                <Input label="Facebook" value={form.social_facebook} onChange={(e) => set('social_facebook', e.target.value)} placeholder="https://facebook.com/yourbusiness" />
                <Input label="Instagram" value={form.social_instagram} onChange={(e) => set('social_instagram', e.target.value)} placeholder="https://instagram.com/yourbusiness" />
                <Input label="LinkedIn" value={form.social_linkedin} onChange={(e) => set('social_linkedin', e.target.value)} placeholder="https://linkedin.com/company/yourbusiness" />
                <Input label="TikTok" value={form.social_tiktok} onChange={(e) => set('social_tiktok', e.target.value)} placeholder="https://tiktok.com/@yourbusiness" />
                <Input label="YouTube" value={form.social_youtube} onChange={(e) => set('social_youtube', e.target.value)} placeholder="https://youtube.com/@yourbusiness" />
                <Input label="X / Twitter" value={form.social_twitter} onChange={(e) => set('social_twitter', e.target.value)} placeholder="https://x.com/yourbusiness" />
              </div>
            </Card>
          )}

          {step === 'goals' && (
            <Card title="Project Goals & Notes">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Project Goals</label>
                  {form.project_goals.map((g, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <Input className="flex-1" value={g} onChange={(e) => setGoal(i, e.target.value)} placeholder={`Goal ${i + 1}`} />
                      {form.project_goals.length > 1 && (
                        <button type="button" onClick={() => removeGoal(i)} className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 px-2">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={addGoal} className="text-sm text-sky-600 hover:text-sky-700 dark:text-sky-400 font-medium">+ Add another goal</button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Special Requirements</label>
                  <textarea className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 dark:bg-[#0a0a0a] dark:border-[#262626] dark:text-gray-100" rows={3} value={form.special_requirements} onChange={(e) => set('special_requirements', e.target.value)} placeholder="Any specific features, integrations, or requirements?" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Anything Else?</label>
                  <textarea className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 dark:bg-[#0a0a0a] dark:border-[#262626] dark:text-gray-100" rows={3} value={form.additional_notes} onChange={(e) => set('additional_notes', e.target.value)} placeholder="Any additional information you'd like us to know..." />
                </div>
              </div>
            </Card>
          )}

          {step === 'review' && (
            <Card title="Review Your Information">
              <div className="space-y-6 text-sm">
                <section>
                  <h4 className="font-semibold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider mb-2">Business Info</h4>
                  <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                    <Pair label="Name" value={form.contact_name} />
                    <Pair label="Business" value={form.company_name} />
                    <Pair label="Email" value={form.contact_email} />
                    <Pair label="Phone" value={form.contact_phone} />
                    <Pair label="Website" value={form.existing_website} />
                    <Pair label="Revenue Range" value={form.revenue_range} />
                    <Pair label="Team Size" value={form.team_size} />
                    <Pair label="Hours" value={form.business_hours} />
                  </dl>
                  {form.business_description && <p className="mt-2 text-gray-600 dark:text-gray-400">{form.business_description}</p>}
                  {form.looking_for && (
                    <div className="mt-2">
                      <span className="text-gray-500 dark:text-gray-400">Looking for:</span>{' '}
                      <span className="text-gray-700 dark:text-gray-300">{form.looking_for}</span>
                    </div>
                  )}
                </section>

                <section>
                  <h4 className="font-semibold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider mb-2">Branding</h4>
                  <dl className="space-y-1">
                    {form.color_preferences && <Pair label="Colors" value={form.color_preferences} />}
                    {form.content_tone && <Pair label="Tone" value={form.content_tone} />}
                    {form.brand_guidelines && <Pair label="Guidelines" value={form.brand_guidelines} />}
                    {form.inspirations && <Pair label="Inspirations" value={form.inspirations} />}
                  </dl>
                </section>

                {(form.social_instagram || form.social_facebook || form.social_linkedin || form.social_tiktok || form.social_youtube || form.social_twitter) && (
                  <section>
                    <h4 className="font-semibold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider mb-2">Online Presence</h4>
                    <dl className="space-y-1">
                      {form.social_facebook && <Pair label="Facebook" value={form.social_facebook} />}
                      {form.social_instagram && <Pair label="Instagram" value={form.social_instagram} />}
                      {form.social_linkedin && <Pair label="LinkedIn" value={form.social_linkedin} />}
                      {form.social_tiktok && <Pair label="TikTok" value={form.social_tiktok} />}
                      {form.social_youtube && <Pair label="YouTube" value={form.social_youtube} />}
                      {form.social_twitter && <Pair label="X / Twitter" value={form.social_twitter} />}
                    </dl>
                  </section>
                )}

                {form.project_goals.filter(g => g.trim()).length > 0 && (
                  <section>
                    <h4 className="font-semibold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider mb-2">Goals</h4>
                    <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
                      {form.project_goals.filter(g => g.trim()).map((g, i) => <li key={i}>{g}</li>)}
                    </ul>
                  </section>
                )}

              </div>
            </Card>
          )}
        </form>

        {/* Spacer so content isn't hidden behind sticky bar */}
        <div className="h-28" />

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 pb-2">
          Powered by NWS Media CRM
        </p>
      </div>

      {/* Sticky bottom navigation bar */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur-sm dark:border-[#1a1a1a] dark:bg-black/95">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3 sm:px-6">
          <div>
            {stepIdx > 0 ? (
              <Button type="button" variant="secondary" onClick={prev}>
                <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </Button>
            ) : (
              <span />
            )}
          </div>
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
            Step {stepIdx + 1} of {STEPS.length}
          </span>
          <div>
            {step === 'review' ? (
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-6 py-3 text-base font-semibold text-white shadow-md transition-colors hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            ) : (
              <button
                type="button"
                onClick={next}
                className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-sky-700"
              >
                Continue
                <svg className="ml-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-gray-500 dark:text-gray-400">{label}:</span>{' '}
      <span className="font-medium text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  );
}
