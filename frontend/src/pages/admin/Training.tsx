import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../utils/api';

interface Material {
  id: string;
  title: string;
  description: string | null;
  category: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
  target_roles: string[];
  sort_order: number;
  required: boolean;
  creator_first: string;
  creator_last: string;
  completion_count: string;
  target_count: string;
  created_at: string;
}

interface UserProgress {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  total: string;
  completed: string;
}

const CATEGORIES = [
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'sales', label: 'Sales' },
  { value: 'operations', label: 'Operations' },
  { value: 'tools', label: 'Tools & Software' },
  { value: 'policies', label: 'Policies' },
  { value: 'general', label: 'General' },
];

const ROLES = [
  { value: 'va', label: 'VA' },
  { value: 'closer', label: 'Closers' },
  { value: 'ops', label: 'Ops' },
  { value: 'all', label: 'All Roles' },
];

export function AdminTraining() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [report, setReport] = useState<UserProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'materials' | 'progress'>('materials');
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'onboarding',
    target_roles: ['all'] as string[],
    required: false,
    sort_order: 0,
  });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [matRes, repRes] = await Promise.all([
        api.get<{ materials: Material[] }>('/training'),
        api.get<{ users: UserProgress[] }>('/training/report'),
      ]);
      setMaterials(matRes.materials);
      setReport(repRes.users);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file || !form.title) return;

    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', form.title);
    fd.append('description', form.description);
    fd.append('category', form.category);
    fd.append('target_roles', form.target_roles.join(','));
    fd.append('required', String(form.required));
    fd.append('sort_order', String(form.sort_order));

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/training', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error('Upload failed');
      setShowUpload(false);
      setForm({ title: '', description: '', category: 'onboarding', target_roles: ['all'], required: false, sort_order: 0 });
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
    }
  }

  async function handleUpdate() {
    if (!editingId) return;
    try {
      await api.patch(`/training/${editingId}`, form);
      setEditingId(null);
      await load();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this training material?')) return;
    try {
      await api.delete(`/training/${id}`);
      await load();
    } catch (e) {
      console.error(e);
    }
  }

  function toggleRole(role: string) {
    setForm((prev) => {
      const has = prev.target_roles.includes(role);
      if (role === 'all') return { ...prev, target_roles: has ? [] : ['all'] };
      const without = prev.target_roles.filter((r) => r !== 'all' && r !== role);
      return { ...prev, target_roles: has ? without : [...without, role] };
    });
  }

  function startEdit(m: Material) {
    setEditingId(m.id);
    setForm({
      title: m.title,
      description: m.description || '',
      category: m.category,
      target_roles: m.target_roles,
      required: m.required,
      sort_order: m.sort_order,
    });
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const grouped = materials.reduce<Record<string, Material[]>>((acc, m) => {
    (acc[m.category] = acc[m.category] || []).push(m);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-600 border-t-transparent dark:border-white dark:border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Training Materials</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage onboarding PDFs and training docs for your team</p>
        </div>
        <button
          onClick={() => { setShowUpload(true); setEditingId(null); setForm({ title: '', description: '', category: 'onboarding', target_roles: ['all'], required: false, sort_order: 0 }); }}
          className="flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-black"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Upload Material
        </button>
      </div>

      {/* Course Manager Banner */}
      <Link
        to="/admin/courses"
        className="flex items-center gap-5 rounded-xl border-2 border-neutral-200 dark:border-neutral-800 bg-gradient-to-r from-neutral-50 to-purple-50 dark:from-[#111] dark:to-purple-900/20 p-5 hover:shadow-lg transition-all group"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white shadow-lg group-hover:scale-110 transition-transform">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" /></svg>
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Interactive Courses</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Create and manage slide-based training courses with quizzes for your team
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2 text-neutral-700 dark:text-white font-semibold text-sm group-hover:gap-3 transition-all">
          Manage Courses
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </Link>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-[#0a0a0a] p-1 w-fit">
        {(['materials', 'progress'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm dark:bg-[#111] dark:text-gray-100' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            {t === 'materials' ? 'Materials' : 'Team Progress'}
          </button>
        ))}
      </div>

      {/* Upload / Edit Modal */}
      {(showUpload || editingId) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-[#0a0a0a] space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{editingId ? 'Edit Material' : 'Upload Training Material'}</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
              <input
                className="w-full rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. VA Onboarding Handbook"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea
                className="w-full rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What this document covers..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <select
                  className="w-full rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sort Order</label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assign to Roles</label>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => toggleRole(r.value)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                      form.target_roles.includes(r.value)
                        ? 'bg-neutral-100 border-neutral-300 text-neutral-800 dark:bg-[#1a1a1a] dark:border-neutral-700 dark:text-white'
                        : 'bg-gray-50 border-gray-200 text-gray-600 dark:bg-[#111] dark:border-[#262626] dark:text-gray-400'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.required}
                onChange={(e) => setForm({ ...form, required: e.target.checked })}
                className="rounded border-gray-300 text-neutral-700"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Required reading</span>
            </label>
            {!editingId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">File (PDF, DOC, etc.) *</label>
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.mp4,.webm" className="text-sm text-gray-600 dark:text-gray-300" />
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setShowUpload(false); setEditingId(null); }}
                className="rounded-lg border border-gray-300 dark:border-[#262626] px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#111]"
              >
                Cancel
              </button>
              <button
                onClick={editingId ? handleUpdate : handleUpload}
                disabled={uploading || !form.title}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : editingId ? 'Save Changes' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'materials' && (
        <div className="space-y-6">
          {Object.entries(grouped).length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-[#1a1a1a] p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              <p className="mt-4 text-gray-500 dark:text-gray-400">No training materials yet. Upload your first PDF to get started.</p>
            </div>
          )}
          {CATEGORIES.filter((c) => grouped[c.value]).map((cat) => (
            <div key={cat.value}>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{cat.label}</h3>
              <div className="space-y-2">
                {grouped[cat.value].map((m) => (
                  <div key={m.id} className="flex items-center gap-4 rounded-lg border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] p-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{m.title}</span>
                        {m.required && <span className="rounded bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">Required</span>}
                      </div>
                      {m.description && <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{m.description}</p>}
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span>{m.file_name}</span>
                        <span>{formatSize(m.file_size)}</span>
                        <span>Roles: {m.target_roles.join(', ')}</span>
                        <span>{parseInt(m.completion_count)}/{parseInt(m.target_count)} completed</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={m.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-gray-200 dark:border-[#262626] p-2 text-gray-500 hover:bg-gray-50 dark:hover:bg-[#111] dark:text-gray-400"
                        title="View file"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </a>
                      <button
                        onClick={() => startEdit(m)}
                        className="rounded-lg border border-gray-200 dark:border-[#262626] p-2 text-gray-500 hover:bg-gray-50 dark:hover:bg-[#111] dark:text-gray-400"
                        title="Edit"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="rounded-lg border border-red-200 dark:border-red-800 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-red-400"
                        title="Delete"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'progress' && (
        <div className="rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-[#1a1a1a] bg-gray-50 dark:bg-[#0a0a0a]">
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Employee</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Role</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Progress</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Completed</th>
              </tr>
            </thead>
            <tbody>
              {report.map((u) => {
                const total = parseInt(u.total);
                const completed = parseInt(u.completed);
                const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
                return (
                  <tr key={u.id} className="border-b border-gray-100 dark:border-[#1a1a1a]">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{u.first_name} {u.last_name}</td>
                    <td className="px-4 py-3 capitalize text-gray-600 dark:text-gray-400">{u.role}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-[#111] max-w-[200px]">
                          <div
                            className={`h-2 rounded-full transition-all ${pct === 100 ? 'bg-green-500' : pct > 50 ? 'bg-neutral-800' : 'bg-amber-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-10">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{completed}/{total}</td>
                  </tr>
                );
              })}
              {report.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No active employees</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
