import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';

interface DbCourse {
  id: string;
  slug: string;
  title: string;
  description: string;
  module_count: number;
}

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
  completed: boolean;
  completed_at: string | null;
}

interface Progress {
  total: number;
  completed: number;
}

const CATEGORY_META: Record<string, { label: string; icon: string; color: string }> = {
  onboarding: { label: 'Onboarding', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z', color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
  sales: { label: 'Sales', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6', color: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
  operations: { label: 'Operations', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', color: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
  tools: { label: 'Tools & Software', icon: 'M11.42 15.17l-5.66-5.66a2 2 0 010-2.83l.71-.71a2 2 0 012.83 0l5.66 5.66a2 2 0 010 2.83l-.71.71a2 2 0 01-2.83 0zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z', color: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
  policies: { label: 'Policies', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color: 'bg-gray-50 text-gray-600 dark:bg-black/30 dark:text-gray-400' },
  general: { label: 'General', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' },
};

export function TrainingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [progress, setProgress] = useState<Progress>({ total: 0, completed: 0 });
  const [dbCourses, setDbCourses] = useState<DbCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [matRes, progRes, courseRes] = await Promise.all([
        api.get<{ materials: Material[] }>('/training'),
        api.get<Progress>('/training/progress'),
        api.get<{ courses: DbCourse[] }>('/training/courses').catch(() => ({ courses: [] })),
      ]);
      setMaterials(matRes.materials);
      setProgress(progRes);
      setDbCourses(courseRes.courses || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function toggleComplete(id: string, completed: boolean) {
    try {
      if (completed) {
        await api.delete(`/training/${id}/complete`);
      } else {
        await api.post(`/training/${id}/complete`, {});
      }
      setMaterials((prev) =>
        prev.map((m) => (m.id === id ? { ...m, completed: !completed, completed_at: !completed ? new Date().toISOString() : null } : m))
      );
      setProgress((prev) => ({
        ...prev,
        completed: completed ? prev.completed - 1 : prev.completed + 1,
      }));
    } catch (e) {
      console.error(e);
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const categories = [...new Set(materials.map((m) => m.category))];
  const filtered = filter === 'all' ? materials : filter === 'incomplete' ? materials.filter((m) => !m.completed) : materials.filter((m) => m.category === filter);
  const pct = progress.total === 0 ? 0 : Math.round((progress.completed / progress.total) * 100);

  const grouped = filtered.reduce<Record<string, Material[]>>((acc, m) => {
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
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Training</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Complete your onboarding training materials</p>
      </div>

      {/* Progress Card */}
      <div className="rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Your Progress</h2>
          <span className={`text-2xl font-bold ${pct === 100 ? 'text-green-600 dark:text-green-400' : 'text-neutral-700 dark:text-white'}`}>{pct}%</span>
        </div>
        <div className="h-3 rounded-full bg-gray-200 dark:bg-[#111] mb-2">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${pct === 100 ? 'bg-green-500' : 'bg-neutral-800'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {progress.completed} of {progress.total} materials completed
          {pct === 100 && <span className="ml-2 text-green-600 dark:text-green-400 font-medium">All done!</span>}
        </p>
      </div>

      {/* Interactive Courses */}
      {user?.role && (
        <button
          onClick={() => navigate(`/${user.role}/training/course`)}
          className="w-full rounded-xl border-2 border-neutral-200 dark:border-brand-800 bg-gradient-to-r from-brand-50 to-purple-50 dark:from-brand-900/20 dark:to-purple-900/20 p-6 text-left hover:shadow-lg transition-all group"
        >
          <div className="flex items-center gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white shadow-lg group-hover:scale-110 transition-transform">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" /></svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">VA Cold Caller — Onboarding Course</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Interactive slide-based training with quizzes. Covers company overview, services, pricing, scripts, objection handling, and advanced techniques.
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-2 text-neutral-700 dark:text-white font-semibold text-sm group-hover:gap-3 transition-all">
              Start Course
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </button>
      )}

      {dbCourses.filter(c => c.slug !== 'va-cold-caller-onboarding').map((c) => (
        <button
          key={c.id}
          onClick={() => navigate(`/${user!.role}/training/course/${c.slug}`)}
          className="w-full rounded-xl border-2 border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] p-6 text-left hover:shadow-lg hover:border-neutral-300 dark:hover:border-brand-700 transition-all group"
        >
          <div className="flex items-center gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white shadow-lg group-hover:scale-110 transition-transform">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" /></svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{c.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {c.description || 'Interactive training course'} &middot; {c.module_count} modules
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-2 text-neutral-700 dark:text-white font-semibold text-sm group-hover:gap-3 transition-all">
              Start Course
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </button>
      ))}

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
            filter === 'all' ? 'bg-neutral-100 border-neutral-300 text-neutral-800 dark:bg-[#1a1a1a] dark:border-neutral-700 dark:text-white' : 'bg-white border-gray-200 text-gray-600 dark:bg-[#0a0a0a] dark:border-[#262626] dark:text-gray-400'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('incomplete')}
          className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
            filter === 'incomplete' ? 'bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-900/40 dark:border-amber-600 dark:text-amber-400' : 'bg-white border-gray-200 text-gray-600 dark:bg-[#0a0a0a] dark:border-[#262626] dark:text-gray-400'
          }`}
        >
          Not Completed
        </button>
        {categories.map((cat) => {
          const meta = CATEGORY_META[cat] || CATEGORY_META.general;
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                filter === cat ? 'bg-neutral-100 border-neutral-300 text-neutral-800 dark:bg-[#1a1a1a] dark:border-neutral-700 dark:text-white' : 'bg-white border-gray-200 text-gray-600 dark:bg-[#0a0a0a] dark:border-[#262626] dark:text-gray-400'
              }`}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Materials */}
      {Object.entries(grouped).length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-[#1a1a1a] p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">{filter === 'incomplete' ? 'All training materials completed!' : 'No training materials assigned to you yet.'}</p>
        </div>
      )}

      {Object.keys(CATEGORY_META).filter((c) => grouped[c]).map((cat) => {
        const meta = CATEGORY_META[cat];
        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${meta.color}`}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={meta.icon} /></svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{meta.label}</h3>
            </div>
            <div className="space-y-2">
              {grouped[cat].map((m) => (
                <div
                  key={m.id}
                  className={`flex items-center gap-4 rounded-lg border p-4 transition-colors ${
                    m.completed
                      ? 'border-green-200 bg-green-50/50 dark:border-green-800/50 dark:bg-green-900/10'
                      : 'border-gray-200 bg-white dark:border-[#1a1a1a] dark:bg-[#0a0a0a]'
                  }`}
                >
                  <button
                    onClick={() => toggleComplete(m.id, m.completed)}
                    className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      m.completed
                        ? 'border-green-500 bg-green-500 text-white'
                        : 'border-gray-300 dark:border-[#262626] hover:border-brand-400'
                    }`}
                  >
                    {m.completed && (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    )}
                  </button>

                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${m.completed ? 'text-gray-500 line-through dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>{m.title}</span>
                      {m.required && <span className="rounded bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">Required</span>}
                    </div>
                    {m.description && <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{m.description}</p>}
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span>{m.file_name}</span>
                      <span>{formatSize(m.file_size)}</span>
                      {m.completed_at && <span className="text-green-600 dark:text-green-400">Completed {new Date(m.completed_at).toLocaleDateString()}</span>}
                    </div>
                  </div>

                  <a
                    href={m.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-black"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Open
                  </a>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
