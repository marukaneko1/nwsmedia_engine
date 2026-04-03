import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

async function portalApi(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('portal_token');
  const res = await fetch(`/api/portal${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers as any },
  });
  return res.json();
}

export function PortalAuthCallback() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      if (!token) {
        setError('Invalid login link.');
        return;
      }
      const data = await portalApi(`/auth/${encodeURIComponent(token)}`);
      if (cancelled) return;
      if (data.error || !data.token) {
        setError(data.error || 'This link is invalid or has expired.');
        return;
      }
      localStorage.setItem('portal_token', data.token);
      navigate('/portal/dashboard', { replace: true });
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-white px-4">
      <div className="flex items-center gap-3 rounded-2xl border border-sky-100 bg-white px-8 py-10 shadow-sm shadow-sky-100/50">
        {!error ? (
          <>
            <div
              className="h-9 w-9 shrink-0 rounded-full border-2 border-sky-200 border-t-sky-600 animate-spin"
              aria-hidden
            />
            <div>
              <p className="font-medium text-slate-800">Signing you in…</p>
              <p className="mt-1 text-sm text-slate-500">Verifying your secure link.</p>
            </div>
          </>
        ) : (
          <div className="max-w-sm text-center">
            <p className="font-medium text-red-800">Couldn&apos;t sign you in</p>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
            <button
              type="button"
              className="mt-6 text-sm font-medium text-sky-600 hover:text-sky-700"
              onClick={() => navigate('/portal/login', { replace: true })}
            >
              Back to portal login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
