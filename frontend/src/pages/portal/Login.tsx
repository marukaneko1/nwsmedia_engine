import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

async function portalApi(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('portal_token');
  const res = await fetch(`/api/portal${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers as any },
  });
  return res.json();
}

export function PortalLogin() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setSent(false);
    try {
      const data = await portalApi('/auth/request-link', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      if (data.error) {
        setError(data.error);
        return;
      }
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-sky-50/80">
      <header className="border-b border-sky-100/80 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-center px-4 py-6">
          <div className="flex items-center gap-3">
            <img src="/logo.jpeg" alt="NWS Media" className="h-11 w-11 rounded-xl object-cover shadow-md shadow-sky-200/50" />
            <div className="text-left">
              <p className="text-base font-semibold tracking-tight text-slate-800">NWS Media</p>
              <p className="text-xs text-sky-600/90">Client Portal</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-lg flex-col px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Welcome back</h1>
          <p className="mt-2 text-sm text-slate-600">Enter your email and we&apos;ll send you a secure login link.</p>
        </div>

        <div className="rounded-2xl border border-sky-100 bg-white p-8 shadow-sm shadow-sky-100/50">
          {sent ? (
            <div className="rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-5 text-center text-sm text-slate-700">
              <p className="font-medium text-sky-900">Check your inbox</p>
              <p className="mt-2 text-slate-600">
                If an account exists for that email, we sent you a login link. It expires in 15 minutes.
              </p>
              <Button type="button" variant="secondary" className="mt-6" onClick={() => setSent(false)}>
                Use a different email
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
              )}
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                placeholder="you@company.com"
                required
                className="border-sky-100 focus:border-sky-400 focus:ring-sky-400"
              />
              <Button type="submit" disabled={loading} className="w-full bg-sky-600 hover:bg-sky-700 focus:ring-sky-500" size="lg">
                {loading ? 'Sending…' : 'Send Login Link'}
              </Button>
            </form>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          Need help?{' '}
          <button type="button" className="font-medium text-sky-600 hover:text-sky-700" onClick={() => navigate('/login')}>
            Staff sign in
          </button>
        </p>
      </main>
    </div>
  );
}
