import { useState, useEffect } from 'react';
import { api } from '../../utils/api';

interface Profile {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  phone: string | null;
  personal_email: string | null;
  personal_phone: string | null;
  preferred_phone: string | null;
  bio: string | null;
  date_of_birth: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  join_date: string | null;
  created_at: string;
}

export function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<'info' | 'password'>('info');

  const [form, setForm] = useState({
    first_name: '', last_name: '', phone: '', personal_email: '',
    personal_phone: '', preferred_phone: '', bio: '',
    date_of_birth: '', address_street: '', address_city: '',
    address_state: '', address_zip: '',
    emergency_contact_name: '', emergency_contact_phone: '',
  });

  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ user: Profile }>('/profile');
      setProfile(res.user);
      setForm({
        first_name: res.user.first_name || '',
        last_name: res.user.last_name || '',
        phone: res.user.phone || '',
        personal_email: res.user.personal_email || '',
        personal_phone: res.user.personal_phone || '',
        preferred_phone: res.user.preferred_phone || '',
        bio: res.user.bio || '',
        date_of_birth: res.user.date_of_birth?.split('T')[0] || '',
        address_street: res.user.address_street || '',
        address_city: res.user.address_city || '',
        address_state: res.user.address_state || '',
        address_zip: res.user.address_zip || '',
        emergency_contact_name: res.user.emergency_contact_name || '',
        emergency_contact_phone: res.user.emergency_contact_phone || '',
      });
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await api.patch('/profile', form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  async function handleChangePassword() {
    setPwError('');
    setPwSuccess(false);
    if (pwForm.new_password !== pwForm.confirm_password) { setPwError('Passwords do not match'); return; }
    if (pwForm.new_password.length < 8) { setPwError('Password must be at least 8 characters'); return; }

    try {
      await api.post('/profile/change-password', {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      setPwSuccess(true);
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (e: any) {
      setPwError(e.message || 'Failed to change password');
    }
  }

  function setField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-600 border-t-transparent dark:border-white dark:border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-800 font-bold text-xl dark:bg-[#1a1a1a] dark:text-white">
          {profile?.first_name?.[0]}{profile?.last_name?.[0]}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{profile?.first_name} {profile?.last_name}</h1>
          <p className="text-gray-500 dark:text-gray-400 capitalize">{profile?.role} &middot; {profile?.email}</p>
          {profile?.join_date && (
            <p className="text-xs text-gray-400">Joined {new Date(profile.join_date).toLocaleDateString()}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-[#0a0a0a] p-1 w-fit">
        {(['info', 'password'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm dark:bg-[#111] dark:text-gray-100' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            {t === 'info' ? 'Profile Info' : 'Change Password'}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] p-5 space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Personal Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">First Name</label>
                <input className="w-full rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100" value={form.first_name} onChange={(e) => setField('first_name', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Last Name</label>
                <input className="w-full rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100" value={form.last_name} onChange={(e) => setField('last_name', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Work Phone</label>
                <input className="w-full rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100" value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Personal Email</label>
                <input className="w-full rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100" value={form.personal_email} onChange={(e) => setField('personal_email', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Personal Phone</label>
                <input className="w-full rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100" value={form.personal_phone} onChange={(e) => setField('personal_phone', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Date of Birth</label>
                <input type="date" className="w-full rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100" value={form.date_of_birth} onChange={(e) => setField('date_of_birth', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Bio</label>
              <textarea className="w-full rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100" rows={2} value={form.bio} onChange={(e) => setField('bio', e.target.value)} placeholder="A short bio..." />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] p-5 space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Address</h3>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Street</label>
              <input className="w-full rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100" value={form.address_street} onChange={(e) => setField('address_street', e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">City</label>
                <input className="w-full rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100" value={form.address_city} onChange={(e) => setField('address_city', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">State</label>
                <input className="w-full rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100" value={form.address_state} onChange={(e) => setField('address_state', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">ZIP</label>
                <input className="w-full rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100" value={form.address_zip} onChange={(e) => setField('address_zip', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] p-5 space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Emergency Contact</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Name</label>
                <input className="w-full rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100" value={form.emergency_contact_name} onChange={(e) => setField('emergency_contact_name', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Phone</label>
                <input className="w-full rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100" value={form.emergency_contact_phone} onChange={(e) => setField('emergency_contact_phone', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 justify-end">
            {saved && <span className="text-sm text-green-600 dark:text-green-400">Profile saved!</span>}
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {tab === 'password' && (
        <div className="rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] p-5 space-y-4 max-w-md">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Change Password</h3>
          {pwError && <p className="text-sm text-red-600 dark:text-red-400">{pwError}</p>}
          {pwSuccess && <p className="text-sm text-green-600 dark:text-green-400">Password changed successfully!</p>}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Current Password</label>
            <input type="password" className="w-full rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100" value={pwForm.current_password} onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">New Password</label>
            <input type="password" className="w-full rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100" value={pwForm.new_password} onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Confirm New Password</label>
            <input type="password" className="w-full rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100" value={pwForm.confirm_password} onChange={(e) => setPwForm({ ...pwForm, confirm_password: e.target.value })} />
          </div>
          <button
            onClick={handleChangePassword}
            disabled={!pwForm.current_password || !pwForm.new_password || !pwForm.confirm_password}
            className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
          >
            Update Password
          </button>
        </div>
      )}
    </div>
  );
}
